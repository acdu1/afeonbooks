from datetime import datetime
import time

while True:
     # Get current time and format with microseconds shortened to milliseconds
    print(datetime.now().strftime("%H:%M:%S.%f")[:-3], end="\r")
    time.sleep(0.01) # Small delay to prevent high CPU usage
