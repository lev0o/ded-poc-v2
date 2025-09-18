#!/usr/bin/env python3
"""
Simple test script for the forecasting endpoint
"""
import requests
import json
from datetime import datetime, timedelta

# Sample time series data (sales data for the last 30 days)
base_date = datetime.now() - timedelta(days=30)
sample_data = []

for i in range(30):
    date = base_date + timedelta(days=i)
    # Simulate some sales data with trend and seasonality
    value = 100 + i * 2 + (i % 7) * 10 + (i % 30) * 0.5
    sample_data.append({
        "ds": date.strftime("%Y-%m-%d"),
        "y": value
    })

# Test request
request_data = {
    "data": sample_data,
    "periods": 14,  # Forecast next 14 days
    "freq": "D"    # Daily frequency
}

print("Testing forecasting endpoint...")
print(f"Sample data points: {len(sample_data)}")
print(f"Forecast periods: {request_data['periods']}")
print("\nFirst few data points:")
for i in range(3):
    print(f"  {sample_data[i]['ds']}: {sample_data[i]['y']:.1f}")

print("\nSending request to /forecasting/forecast...")

try:
    response = requests.post(
        "http://localhost:8000/forecasting/forecast",
        json=request_data,
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code == 200:
        result = response.json()
        print("✅ Forecast successful!")
        print(f"Historical data points: {len(result['historical_data'])}")
        print(f"Forecast data points: {len(result['forecast_data'])}")
        print(f"Model info: {result['model_info']}")
        
        print("\nFirst few forecast results:")
        for i in range(3):
            forecast = result['forecast_data'][i]
            print(f"  {forecast['ds']}: {forecast['yhat']:.1f} (CI: {forecast['yhat_lower']:.1f} - {forecast['yhat_upper']:.1f})")
            
    else:
        print(f"❌ Error: {response.status_code}")
        print(response.text)
        
except requests.exceptions.ConnectionError:
    print("❌ Could not connect to server. Make sure the backend is running on localhost:8000")
except Exception as e:
    print(f"❌ Error: {e}")
