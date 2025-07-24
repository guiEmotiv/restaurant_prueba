from rest_framework import serializers
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from .models import RestaurantUser


class UserLoginSerializer(serializers.Serializer):
    """Serializer for user login"""
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
    
    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')
        
        if username and password:
            user = authenticate(username=username, password=password)
            if user:
                if not user.is_active:
                    raise serializers.ValidationError('User account is disabled.')
                attrs['user'] = user
                return attrs
            else:
                raise serializers.ValidationError('Unable to log in with provided credentials.')
        else:
            raise serializers.ValidationError('Must include "username" and "password".')


class UserSerializer(serializers.ModelSerializer):
    """Serializer for user information"""
    
    class Meta:
        model = RestaurantUser
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 
            'role', 'is_active', 'allowed_views', 'allowed_api_endpoints',
            'last_activity', 'is_active_session'
        ]
        read_only_fields = ['id', 'allowed_views', 'allowed_api_endpoints']


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new users"""
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = RestaurantUser
        fields = [
            'username', 'email', 'first_name', 'last_name',
            'role', 'password', 'password_confirm', 'aws_iam_username'
        ]
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError("Passwords don't match.")
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        user = RestaurantUser.objects.create_user(**validated_data)
        user.set_password(password)
        user.save()
        return user


class LoginResponseSerializer(serializers.Serializer):
    """Serializer for login response"""
    token = serializers.CharField()
    user = UserSerializer()
    message = serializers.CharField()