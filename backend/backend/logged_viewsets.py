"""
Enhanced ViewSets with detailed permission logging
"""
import logging
import time
from rest_framework import viewsets
from rest_framework.response import Response
from backend.permissions_logger import PermissionLogger

logger = logging.getLogger('backend.auth_views')

class LoggedModelViewSet(viewsets.ModelViewSet):
    """
    ModelViewSet with comprehensive permission logging
    """

    def check_permissions(self, request):
        """Override to log permission checks"""
        start_time = time.time()
        action = getattr(self, 'action', None) or 'unknown'
        view_name = f"{self.__class__.__name__}.{action}"
        user = request.user
        method = request.method

        # Get permission classes for this action
        permission_classes = self.get_permissions()
        permission_names = [p.__class__.__name__ for p in permission_classes]

        try:
            # Call original permission check
            super().check_permissions(request)
            result = True
            error_msg = None

        except Exception as e:
            result = False
            error_msg = str(e)

            # Log detailed permission failure
            logger.warning(f"🚫 PERMISSION CHECK FAILED: {view_name}")
            logger.warning(f"   👤 User: {user.username if user.is_authenticated else 'Anonymous'}")
            logger.warning(f"   🔒 Required: {', '.join(permission_names)}")
            logger.warning(f"   ❌ Error: {error_msg}")
            logger.warning(f"   🌐 Method: {method} | Action: {action}")

            if user.is_authenticated:
                groups = [g.name for g in user.groups.all()]
                logger.warning(f"   👥 User groups: {groups}")
                logger.warning(f"   🏛️  User flags: staff={user.is_staff}, super={user.is_superuser}")

            raise  # Re-raise the original exception

        # Log successful permission check
        duration_ms = (time.time() - start_time) * 1000

        PermissionLogger.log_permission_check(
            view_name=view_name,
            user=user,
            method=method,
            permission_classes=[p.__class__ for p in permission_classes],
            result=result,
            duration_ms=duration_ms,
            extra_info={
                'action': action,
                'queryset_count': self.get_queryset().count() if hasattr(self, 'get_queryset') else 'N/A',
                'serializer': self.get_serializer_class().__name__ if hasattr(self, 'get_serializer_class') else 'N/A'
            }
        )

    def check_object_permissions(self, request, obj):
        """Override to log object-level permission checks"""
        start_time = time.time()
        action = getattr(self, 'action', None) or 'unknown'
        view_name = f"{self.__class__.__name__}.{action}"
        user = request.user
        method = request.method

        # Get permission classes for this action
        permission_classes = self.get_permissions()
        permission_names = [p.__class__.__name__ for p in permission_classes]

        try:
            # Call original object permission check
            super().check_object_permissions(request, obj)
            result = True
            error_msg = None

        except Exception as e:
            result = False
            error_msg = str(e)

            # Log detailed object permission failure
            logger.warning(f"🚫 OBJECT PERMISSION FAILED: {view_name}")
            logger.warning(f"   👤 User: {user.username if user.is_authenticated else 'Anonymous'}")
            logger.warning(f"   🎯 Object: {obj.__class__.__name__} #{getattr(obj, 'id', 'unknown')}")
            logger.warning(f"   🔒 Required: {', '.join(permission_names)}")
            logger.warning(f"   ❌ Error: {error_msg}")
            logger.warning(f"   🌐 Method: {method} | Action: {action}")

            if user.is_authenticated:
                groups = [g.name for g in user.groups.all()]
                logger.warning(f"   👥 User groups: {groups}")
                logger.warning(f"   🏛️  User flags: staff={user.is_staff}, super={user.is_superuser}")

            raise  # Re-raise the original exception

        # Log successful object permission check
        duration_ms = (time.time() - start_time) * 1000

        logger.info(f"✅ OBJECT PERMISSION: {view_name}")
        logger.info(f"   👤 User: {user.username if user.is_authenticated else 'Anonymous'}")
        logger.info(f"   🎯 Object: {obj.__class__.__name__} #{getattr(obj, 'id', 'unknown')}")
        logger.info(f"   🔒 Permissions: {', '.join(permission_names)}")
        logger.info(f"   ⏱️  Duration: {duration_ms:.1f}ms")

    def dispatch(self, request, *args, **kwargs):
        """Override to log action execution"""
        start_time = time.time()
        action = getattr(self, 'action', None) or 'dispatch'
        view_name = f"{self.__class__.__name__}.{action}"
        user = request.user
        method = request.method

        logger.info(f"🎬 VIEW EXECUTION: {view_name}")
        logger.info(f"   👤 User: {user.username if user.is_authenticated else 'Anonymous'}")
        logger.info(f"   🌐 Method: {method}")
        logger.info(f"   📍 Args: {args}")
        logger.info(f"   🔧 Kwargs: {kwargs}")

        try:
            # Call original dispatch
            response = super().dispatch(request, *args, **kwargs)

            duration_ms = (time.time() - start_time) * 1000
            status_code = getattr(response, 'status_code', 'unknown')

            logger.info(f"✅ VIEW SUCCESS: {view_name}")
            logger.info(f"   📊 Status: {status_code}")
            logger.info(f"   ⏱️  Duration: {duration_ms:.1f}ms")

            return response

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000

            logger.error(f"💥 VIEW ERROR: {view_name}")
            logger.error(f"   👤 User: {user.username if user.is_authenticated else 'Anonymous'}")
            logger.error(f"   ❌ Error: {str(e)}")
            logger.error(f"   ⏱️  Duration: {duration_ms:.1f}ms")
            logger.error(f"   📍 Exception type: {type(e).__name__}")

            raise  # Re-raise the original exception

    def list(self, request, *args, **kwargs):
        """Override list with logging"""
        logger.info(f"📋 LIST REQUEST: {self.__class__.__name__}")
        logger.info(f"   👤 User: {request.user.username if request.user.is_authenticated else 'Anonymous'}")

        try:
            queryset = self.filter_queryset(self.get_queryset())
            count = queryset.count()
            logger.info(f"   📊 Total records: {count}")

            response = super().list(request, *args, **kwargs)

            logger.info(f"✅ LIST SUCCESS: {self.__class__.__name__} ({count} records)")
            return response

        except Exception as e:
            logger.error(f"💥 LIST ERROR: {self.__class__.__name__} - {str(e)}")
            raise

    def create(self, request, *args, **kwargs):
        """Override create with logging"""
        logger.info(f"➕ CREATE REQUEST: {self.__class__.__name__}")
        logger.info(f"   👤 User: {request.user.username if request.user.is_authenticated else 'Anonymous'}")
        logger.info(f"   📝 Data keys: {list(request.data.keys()) if hasattr(request, 'data') else 'No data'}")

        try:
            response = super().create(request, *args, **kwargs)

            created_id = response.data.get('id', 'unknown') if hasattr(response, 'data') else 'unknown'
            logger.info(f"✅ CREATE SUCCESS: {self.__class__.__name__} #{created_id}")
            return response

        except Exception as e:
            logger.error(f"💥 CREATE ERROR: {self.__class__.__name__} - {str(e)}")
            raise

    def retrieve(self, request, *args, **kwargs):
        """Override retrieve with logging"""
        obj_id = kwargs.get('pk', 'unknown')
        logger.info(f"👁️  RETRIEVE REQUEST: {self.__class__.__name__} #{obj_id}")
        logger.info(f"   👤 User: {request.user.username if request.user.is_authenticated else 'Anonymous'}")

        try:
            response = super().retrieve(request, *args, **kwargs)
            logger.info(f"✅ RETRIEVE SUCCESS: {self.__class__.__name__} #{obj_id}")
            return response

        except Exception as e:
            logger.error(f"💥 RETRIEVE ERROR: {self.__class__.__name__} #{obj_id} - {str(e)}")
            raise

    def update(self, request, *args, **kwargs):
        """Override update with logging"""
        obj_id = kwargs.get('pk', 'unknown')
        logger.info(f"✏️  UPDATE REQUEST: {self.__class__.__name__} #{obj_id}")
        logger.info(f"   👤 User: {request.user.username if request.user.is_authenticated else 'Anonymous'}")
        logger.info(f"   📝 Data keys: {list(request.data.keys()) if hasattr(request, 'data') else 'No data'}")

        try:
            response = super().update(request, *args, **kwargs)
            logger.info(f"✅ UPDATE SUCCESS: {self.__class__.__name__} #{obj_id}")
            return response

        except Exception as e:
            logger.error(f"💥 UPDATE ERROR: {self.__class__.__name__} #{obj_id} - {str(e)}")
            raise

    def partial_update(self, request, *args, **kwargs):
        """Override partial update with logging"""
        obj_id = kwargs.get('pk', 'unknown')
        logger.info(f"📝 PATCH REQUEST: {self.__class__.__name__} #{obj_id}")
        logger.info(f"   👤 User: {request.user.username if request.user.is_authenticated else 'Anonymous'}")
        logger.info(f"   📝 Data keys: {list(request.data.keys()) if hasattr(request, 'data') else 'No data'}")

        try:
            response = super().partial_update(request, *args, **kwargs)
            logger.info(f"✅ PATCH SUCCESS: {self.__class__.__name__} #{obj_id}")
            return response

        except Exception as e:
            logger.error(f"💥 PATCH ERROR: {self.__class__.__name__} #{obj_id} - {str(e)}")
            raise

    def destroy(self, request, *args, **kwargs):
        """Override destroy with logging"""
        obj_id = kwargs.get('pk', 'unknown')
        logger.warning(f"🗑️  DELETE REQUEST: {self.__class__.__name__} #{obj_id}")
        logger.warning(f"   👤 User: {request.user.username if request.user.is_authenticated else 'Anonymous'}")

        try:
            # Get object info before deletion
            obj = self.get_object()
            obj_repr = str(obj) if obj else 'unknown'

            response = super().destroy(request, *args, **kwargs)
            logger.warning(f"✅ DELETE SUCCESS: {self.__class__.__name__} #{obj_id} ({obj_repr})")
            return response

        except Exception as e:
            logger.error(f"💥 DELETE ERROR: {self.__class__.__name__} #{obj_id} - {str(e)}")
            raise