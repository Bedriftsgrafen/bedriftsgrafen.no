#!/bin/bash
# Check disk space and alert if usage > 80%

THRESHOLD=80
USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')

if [ $USAGE -gt $THRESHOLD ]; then
    echo "$(date): WARNING - Disk usage at ${USAGE}%"
    # Optional: Send notification (e.g., via email or webhook)
else
    echo "$(date): Disk usage OK (${USAGE}%)"
fi
