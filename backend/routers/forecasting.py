from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
from prophet import Prophet
from datetime import datetime
import logging

router = APIRouter(prefix="/forecasting", tags=["forecasting"])
logger = logging.getLogger(__name__)

class TimeSeriesDataPoint(BaseModel):
    """Single data point for time series forecasting"""
    ds: str  # Date string in YYYY-MM-DD format
    y: float  # Numeric value to forecast

class ForecastRequest(BaseModel):
    """Request model for forecasting"""
    data: List[TimeSeriesDataPoint]
    periods: int = 30  # Number of periods to forecast
    freq: str = "D"    # Frequency: D (daily), W (weekly), M (monthly)

class ForecastResponse(BaseModel):
    """Response model for forecasting results"""
    historical_data: List[dict]
    forecast_data: List[dict]
    confidence_intervals: List[dict]
    model_info: dict

@router.post("/forecast", response_model=ForecastResponse)
async def create_forecast(request: ForecastRequest):
    """
    Create time series forecast using Prophet
    
    Expected data format:
    - ds: Date string (YYYY-MM-DD)
    - y: Numeric value to forecast
    """
    try:
        # Validate input
        if len(request.data) < 2:
            raise HTTPException(status_code=400, detail="At least 2 data points required")
        
        if request.periods <= 0:
            raise HTTPException(status_code=400, detail="Periods must be positive")
        
        # Convert to DataFrame
        df_data = []
        for point in request.data:
            df_data.append({
                'ds': pd.to_datetime(point.ds),
                'y': point.y
            })
        
        df = pd.DataFrame(df_data)
        
        # Validate data
        if df['y'].isna().any():
            raise HTTPException(status_code=400, detail="Data contains missing values")
        
        # Initialize and fit Prophet model
        model = Prophet()
        model.fit(df)
        
        # Create future dataframe
        future = model.make_future_dataframe(periods=request.periods, freq=request.freq)
        
        # Make predictions
        forecast = model.predict(future)
        
        # Prepare response data
        historical_data = []
        forecast_data = []
        confidence_intervals = []
        
        # Historical data (original data points)
        for _, row in df.iterrows():
            historical_data.append({
                "ds": row['ds'].strftime('%Y-%m-%d'),
                "y": float(row['y'])
            })
        
        # Forecast data (future predictions)
        future_forecast = forecast.tail(request.periods)
        for _, row in future_forecast.iterrows():
            forecast_data.append({
                "ds": row['ds'].strftime('%Y-%m-%d'),
                "yhat": float(row['yhat']),
                "yhat_lower": float(row['yhat_lower']),
                "yhat_upper": float(row['yhat_upper'])
            })
        
        # Confidence intervals for historical data
        historical_forecast = forecast.head(len(df))
        for _, row in historical_forecast.iterrows():
            confidence_intervals.append({
                "ds": row['ds'].strftime('%Y-%m-%d'),
                "yhat_lower": float(row['yhat_lower']),
                "yhat_upper": float(row['yhat_upper'])
            })
        
        # Model information
        model_info = {
            "total_data_points": len(df),
            "forecast_periods": request.periods,
            "frequency": request.freq,
            "data_range": {
                "start": df['ds'].min().strftime('%Y-%m-%d'),
                "end": df['ds'].max().strftime('%Y-%m-%d')
            }
        }
        
        return ForecastResponse(
            historical_data=historical_data,
            forecast_data=forecast_data,
            confidence_intervals=confidence_intervals,
            model_info=model_info
        )
        
    except Exception as e:
        logger.error(f"Forecasting error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Forecasting failed: {str(e)}")

@router.get("/health")
async def health_check():
    """Health check for forecasting service"""
    return {"status": "healthy", "service": "forecasting"}
