from django.contrib.auth.models import User
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Create default admin user (admin / admin123)'

    def handle(self, *args, **kwargs):
        username = 'admin'
        email = 'admin@findly.local'
        password = 'admin123'

        if User.objects.filter(username=username).exists():
            user = User.objects.get(username=username)
            user.set_password(password)
            user.is_staff = True
            user.is_superuser = True
            user.save()
            self.stdout.write(self.style.SUCCESS(
                f'Updated existing admin user.\nUsername: {username}\nPassword: {password}'
            ))
        else:
            User.objects.create_superuser(username=username, email=email, password=password)
            self.stdout.write(self.style.SUCCESS(
                f'Created default admin user.\nUsername: {username}\nPassword: {password}'
            ))
