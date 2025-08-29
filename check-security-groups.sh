#!/bin/bash
set -e

# Check EC2 security groups for the current instance
echo "🔍 Checking EC2 instance security groups..."

# Get the instance ID from metadata
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
echo "📍 Instance ID: $INSTANCE_ID"

# Get security group IDs for this instance
SECURITY_GROUPS=$(aws ec2 describe-instances \
    --instance-ids $INSTANCE_ID \
    --query 'Reservations[0].Instances[0].SecurityGroups[*].GroupId' \
    --output text)

echo "🛡️ Security Groups: $SECURITY_GROUPS"

# Check security group rules
for sg in $SECURITY_GROUPS; do
    echo ""
    echo "🔒 Security Group: $sg"
    echo "📥 Inbound Rules:"
    aws ec2 describe-security-groups \
        --group-ids $sg \
        --query 'SecurityGroups[0].IpPermissions[].[IpProtocol,FromPort,ToPort,IpRanges[0].CidrIp]' \
        --output table
done

# Check if ports 80 and 443 are open
echo ""
echo "🌐 Checking specific port access:"

# Port 80
PORT_80_OPEN=$(aws ec2 describe-security-groups \
    --group-ids $SECURITY_GROUPS \
    --query "SecurityGroups[*].IpPermissions[?FromPort==\`80\` && ToPort==\`80\` && IpRanges[?CidrIp==\`0.0.0.0/0\`]]" \
    --output text)

if [[ -n "$PORT_80_OPEN" ]]; then
    echo "✅ Port 80 is open to the public"
else
    echo "❌ Port 80 is NOT open to the public"
fi

# Port 443
PORT_443_OPEN=$(aws ec2 describe-security-groups \
    --group-ids $SECURITY_GROUPS \
    --query "SecurityGroups[*].IpPermissions[?FromPort==\`443\` && ToPort==\`443\` && IpRanges[?CidrIp==\`0.0.0.0/0\`]]" \
    --output text)

if [[ -n "$PORT_443_OPEN" ]]; then
    echo "✅ Port 443 is open to the public"
else
    echo "❌ Port 443 is NOT open to the public"
fi