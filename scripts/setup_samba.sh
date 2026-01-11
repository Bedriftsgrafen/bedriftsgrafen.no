#!/bin/bash

# Exit on error
set -e

echo "Updating package list..."
sudo apt-get update

echo "Installing Samba..."
sudo apt-get install -y samba

# Backup original config
if [ ! -f /etc/samba/smb.conf.bak ]; then
    sudo cp /etc/samba/smb.conf /etc/samba/smb.conf.bak
    echo "Backed up original config to /etc/samba/smb.conf.bak"
fi

# Check if share already exists
if grep -q "\[bedriftsgrafen\]" /etc/samba/smb.conf; then
    echo "Share [bedriftsgrafen] already appears to separate config. Skipping append."
else
    echo "Configuring [bedriftsgrafen] share..."
    cat <<EOF | sudo tee -a /etc/samba/smb.conf

[bedriftsgrafen]
   comment = Bedriftsgrafen Project Workspace
   path = ${HOME}/bedriftsgrafen.no
   browseable = yes
   read only = no
   guest ok = no
   valid users = ${USER}
   create mask = 0664
   directory mask = 0775
   force user = ${USER}
EOF
fi

echo "Restarting Samba service..."
sudo systemctl restart smbd

echo ""
echo "✅ Samba installed and configured."
echo "⚠️  IMPORTANT: You must now set a Samba password for user '${USER}' to access the share."
echo "   Run: sudo smbpasswd -a ${USER}"
