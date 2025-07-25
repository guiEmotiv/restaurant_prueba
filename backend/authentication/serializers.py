from rest_framework import serializers


class UserLoginSerializer(serializers.Serializer):
    """Serializer for AWS IAM user login"""
    username = serializers.CharField(help_text="AWS Access Key ID or simple username")
    password = serializers.CharField(write_only=True, help_text="AWS Secret Access Key or simple password")


class UserSerializer(serializers.Serializer):
    """Serializer for AWS IAM user information"""
    id = serializers.CharField()
    username = serializers.CharField()
    email = serializers.CharField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    role = serializers.CharField()
    is_active = serializers.BooleanField()
    allowed_views = serializers.ListField()
    allowed_api_endpoints = serializers.ListField()
    last_activity = serializers.CharField()
    is_active_session = serializers.BooleanField()


class LoginResponseSerializer(serializers.Serializer):
    """Serializer for login response"""
    token = serializers.CharField()
    user = UserSerializer()
    message = serializers.CharField()