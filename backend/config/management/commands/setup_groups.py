"""
Management command to set up user groups and permissions for the restaurant system
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType


class Command(BaseCommand):
    help = 'Set up user groups and permissions for restaurant management'

    def handle(self, *args, **options):
        """
        Create user groups with appropriate permissions for restaurant roles
        """
        
        # Define restaurant roles and their permissions
        restaurant_groups = {
            'Administradores': {
                'description': 'Full access to all system functionality',
                'permissions': [
                    # All permissions - they're superusers essentially
                    'auth.add_user',
                    'auth.change_user', 
                    'auth.delete_user',
                    'auth.view_user',
                ]
            },
            'Gerentes': {
                'description': 'Management access - can view reports and manage operations',
                'permissions': [
                    # Config permissions
                    'config.view_table',
                    'config.view_zone',
                    'config.view_unit',
                    'config.view_container',
                    # Inventory permissions  
                    'inventory.view_recipe',
                    'inventory.view_ingredient',
                    'inventory.view_group',
                    'inventory.change_ingredient',  # Can adjust stock
                    # Operation permissions
                    'operation.view_order',
                    'operation.view_orderitem',
                    'operation.view_payment',
                    'operation.change_orderitem',  # Can modify orders
                    # Printer permissions
                    'operation.view_printerconfig',
                    'operation.view_printqueue',
                ]
            },
            'Meseros': {
                'description': 'Waitstaff - can create orders and manage customer service',
                'permissions': [
                    # Basic viewing
                    'config.view_table',
                    'config.view_zone',
                    'inventory.view_recipe',
                    # Order management
                    'operation.add_order',
                    'operation.change_order',
                    'operation.view_order',
                    'operation.add_orderitem',
                    'operation.change_orderitem',
                    'operation.view_orderitem',
                    # Container sales
                    'operation.add_containersale',
                    'operation.view_containersale',
                ]
            },
            'Cocineros': {
                'description': 'Kitchen staff - can view orders and update cooking status',
                'permissions': [
                    # View orders and recipes
                    'operation.view_order',
                    'operation.view_orderitem', 
                    'operation.change_orderitem',  # Update cooking status
                    'inventory.view_recipe',
                    'inventory.view_ingredient',
                    # Printer queue management
                    'operation.view_printqueue',
                    'operation.change_printqueue',
                ]
            },
            'Cajeros': {
                'description': 'Cashiers - can process payments and view financial data',
                'permissions': [
                    # Payment processing
                    'operation.add_payment',
                    'operation.view_payment',
                    'operation.change_payment',
                    # Order viewing for payment
                    'operation.view_order',
                    'operation.view_orderitem',
                    'operation.change_order',  # Mark as paid
                    # Container sales
                    'operation.view_containersale',
                ]
            }
        }

        created_groups = 0
        updated_groups = 0

        for group_name, group_info in restaurant_groups.items():
            # Get or create the group
            group, created = Group.objects.get_or_create(name=group_name)
            
            if created:
                created_groups += 1
                self.stdout.write(
                    self.style.SUCCESS(f'✅ Created group: {group_name}')
                )
            else:
                updated_groups += 1
                self.stdout.write(
                    self.style.WARNING(f'⚠️  Updated existing group: {group_name}')
                )

            # Clear existing permissions
            group.permissions.clear()

            # Add permissions for this group
            permissions_added = 0
            for perm_codename in group_info['permissions']:
                try:
                    app_label, codename = perm_codename.split('.')
                    permission = Permission.objects.get(
                        codename=codename,
                        content_type__app_label=app_label
                    )
                    group.permissions.add(permission)
                    permissions_added += 1
                except Permission.DoesNotExist:
                    self.stdout.write(
                        self.style.WARNING(
                            f'   ⚠️  Permission not found: {perm_codename}'
                        )
                    )
                except ValueError:
                    self.stdout.write(
                        self.style.ERROR(
                            f'   ❌ Invalid permission format: {perm_codename}'
                        )
                    )

            self.stdout.write(f'   ➡️  Added {permissions_added} permissions')
            self.stdout.write(f'   📝 {group_info["description"]}')
            self.stdout.write('')

        # Summary
        self.stdout.write(
            self.style.SUCCESS(
                f'\n🎉 Groups setup completed!'
            )
        )
        self.stdout.write(f'   📊 Created: {created_groups} groups')
        self.stdout.write(f'   🔄 Updated: {updated_groups} groups')
        self.stdout.write(f'   📁 Total: {len(restaurant_groups)} groups configured')
        
        # Show usage instructions
        self.stdout.write(
            self.style.HTTP_INFO(
                f'\n📋 Usage Instructions:'
            )
        )
        self.stdout.write('   1. Go to Django Admin: /admin/')
        self.stdout.write('   2. Users → Add user or edit existing user')
        self.stdout.write('   3. Assign user to appropriate group(s)')
        self.stdout.write('   4. Groups available:')
        for group_name in restaurant_groups.keys():
            self.stdout.write(f'      • {group_name}')
        
        self.stdout.write(
            self.style.HTTP_INFO(
                f'\n🔐 Security Note: Administradores have full access. Use carefully!'
            )
        )