#!/bin/bash

# Check AWS Security Groups
echo "🔍 CHECKING AWS SECURITY GROUPS"
echo "==============================="

# Get instance ID
INSTANCE_ID=$(ec2-metadata --instance-id 2>/dev/null | cut -d' ' -f2)
if [ -z "$INSTANCE_ID" ]; then
    echo "❌ Could not get instance ID. Are you running this on EC2?"
    exit 1
fi

echo "Instance ID: $INSTANCE_ID"

# Get security groups
echo -e "\nSecurity Groups attached to this instance:"
aws ec2 describe-instances --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].SecurityGroups[*].[GroupId,GroupName]' --output table 2>/dev/null || {
    echo "⚠️  AWS CLI not configured or no permissions"
    echo ""
    echo "Please check manually in AWS Console:"
    echo "1. Go to EC2 > Instances"
    echo "2. Select your instance"
    echo "3. Check Security tab"
    echo "4. Ensure security group allows:"
    echo "   - Port 80 (HTTP) from 0.0.0.0/0"
    echo "   - Port 443 (HTTPS) from 0.0.0.0/0"
    echo "   - Port 22 (SSH) from your IP"
    exit 1
}

# Check inbound rules
echo -e "\nChecking if ports 80 and 443 are open..."
SG_IDS=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].SecurityGroups[*].GroupId' --output text 2>/dev/null)

for SG_ID in $SG_IDS; do
    echo -e "\nSecurity Group: $SG_ID"
    echo "Inbound rules:"
    aws ec2 describe-security-groups --group-ids $SG_ID --query 'SecurityGroups[0].IpPermissions[?FromPort==`80` || FromPort==`443` || FromPort==`22`].[IpProtocol,FromPort,ToPort,IpRanges[0].CidrIp]' --output table 2>/dev/null
done

echo -e "\n📝 Required rules:"
echo "- Port 22 (SSH) - Your IP or restricted range"
echo "- Port 80 (HTTP) - 0.0.0.0/0 (anywhere)"
echo "- Port 443 (HTTPS) - 0.0.0.0/0 (anywhere)"
echo ""
echo "If port 443 is missing, add it in AWS Console:"
echo "1. EC2 > Security Groups > Select your group"
echo "2. Edit inbound rules"
echo "3. Add rule: HTTPS (443) from Anywhere-IPv4 (0.0.0.0/0)"