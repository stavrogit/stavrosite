import io
import requests
import pandas as pd
import matplotlib
# Use Agg backend for non-interactive server environments (PythonAnywhere)
matplotlib.use('Agg') 
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import matplotlib.patches as mpatches
from datetime import datetime, timedelta, timezone
from flask import Blueprint, send_file, request, abort, current_app

# --- Timezone Handling Setup ---
try:
    from zoneinfo import ZoneInfo
except ImportError:
    # Fallback for Python versions < 3.9
    import pytz
    def ZoneInfo(key):
        return pytz.timezone(key)

# Define the Blueprint
stavrocast_bp = Blueprint('stavrocast_bp', __name__)

# --- Helper Functions ---

def get_model_run_time():
    """
    Calculates the likely ECMWF model run time based on current UTC time.
    ECMWF runs at 00, 06, 12, 18 UTC with ~7 hours latency.
    """
    now_utc = datetime.now(timezone.utc)
    candidates = []
    possible_hours = [0, 6, 12, 18]
    
    # Check today and yesterday
    for days_back in [0, 1]:
        base_date = now_utc - timedelta(days=days_back)
        for h in possible_hours:
            run_time = base_date.replace(hour=h, minute=0, second=0, microsecond=0)
            avail_time = run_time + timedelta(hours=7)
            if now_utc >= avail_time:
                candidates.append(run_time)

    if candidates:
        return max(candidates), "Estimated Schedule"
    return now_utc, "System Time Fallback"

def get_euro_data(lat, lon, forecast_days):
    """Fetches ECMWF EPS data from Open-Meteo."""
    url = "https://ensemble-api.open-meteo.com/v1/ensemble"
    hourly_vars = [
        "temperature_2m", "snowfall", "precipitation_type", "precipitation",
        "wind_speed_10m", "wind_gusts_10m", "wind_direction_10m"
    ]
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join(hourly_vars),
        "wind_speed_unit": "mph",
        "timezone": "America/New_York",
        "models": "ecmwf_ifs025",
        "forecast_days": forecast_days
    }
    
    try:
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        current_app.logger.error(f"Open-Meteo API Error: {e}")
        return None

def process_data(data):
    """Parses JSON response into Pandas DataFrames."""
    hourly = data.get('hourly', {})
    if not hourly:
        return None, None, None, None, None

    times = pd.to_datetime(hourly['time'])
    
    # Organize data keys
    temp_data = {k: v for k, v in hourly.items() if k.startswith('temperature_2m')}
    snow_data = {k: v for k, v in hourly.items() if k.startswith('snowfall')}
    ptype_data = {k: v for k, v in hourly.items() if k.startswith('precipitation_type')}
    precip_data = {k: v for k, v in hourly.items() if k.startswith('precipitation')}
    
    wind_data = {}
    for key, values in hourly.items():
        if key.startswith(('wind_speed_10m', 'wind_gusts_10m', 'wind_direction_10m')):
            base_name = key.split('_10m')[0]
            member_id = ''.join(filter(str.isdigit, key))
            if member_id not in wind_data: wind_data[member_id] = {}
            wind_data[member_id][base_name] = values

    # Create DataFrames
    df_temp = pd.DataFrame(temp_data, index=times)
    df_snow = pd.DataFrame(snow_data, index=times)
    df_ptype = pd.DataFrame(ptype_data, index=times)
    df_precip = pd.DataFrame(precip_data, index=times)

    df_wind_list = []
    for member_id in sorted(wind_data.keys()):
        member_df = pd.DataFrame(wind_data[member_id], index=times)
        member_df = member_df.rename(columns=lambda c: f"{c}_{member_id}")
        df_wind_list.append(member_df)
    
    df_wind = pd.concat(df_wind_list, axis=1) if df_wind_list else pd.DataFrame()

    return df_temp, df_snow, df_ptype, df_precip, df_wind

def create_plot_buffer(df_temp, df_snow, df_ptype, df_precip, df_wind, lat, lon, forecast_days):
    """Generates the matplotlib figure and saves to a BytesIO buffer."""
    
    # Dynamic Width logic
    base_width = 15
    base_days = 10
    dynamic_width = (forecast_days / base_days) * base_width
    
    fig, axes = plt.subplots(5, 1, figsize=(dynamic_width, 24), sharex=True, gridspec_kw={'height_ratios': [1, 1, 1, 1, 1]})
    plt.subplots_adjust(hspace=0.2)
    ax1, ax2, ax3, ax4, ax5 = axes

    run_dt_utc, source = get_model_run_time()
    target_tz = ZoneInfo("America/New_York")
    
    if run_dt_utc:
        run_time_et = run_dt_utc.astimezone(target_tz)
        time_str = f"{run_time_et.strftime('%Y/%m/%d %H:%M ET')} (Run: {run_dt_utc.strftime('%H')}Z)"
    else:
        now_et = datetime.now(target_tz)
        time_str = now_et.strftime('%Y/%m/%d %H:%M ET (System Time)')

    # --- Panel 1: Snowfall ---
    df_cum_snow_in = df_snow.cumsum() * 0.393701
    snow_mean = df_cum_snow_in.mean(axis=1)
    for col in df_cum_snow_in.columns:
        ax1.plot(df_cum_snow_in.index, df_cum_snow_in[col], color='lightgray', alpha=0.4, linewidth=1)
    ax1.plot(snow_mean.index, snow_mean, color='black', linewidth=2.0, label='Mean')
    ax1.set_title("Ensemble Snowfall Depth Forecast")
    ax1.set_ylabel("Accumulated Snowfall (inches)")
    ax1.legend(loc='upper left')
    ax1.grid(True, which='both', linestyle='--', alpha=0.5)

    # --- Panel 2: P-Type ---
    num_members = len(df_ptype.columns)
    if num_members > 0:
        # P-Type codes: 1=Rain, 3=Freezing Rain, 5=Snow, 6=Wet Snow, 7=Mix, 8=Sleet
        ptype_counts = {
            'Rain': (df_ptype == 1).sum(axis=1),
            'Freezing Rain (Ice)': (df_ptype == 3).sum(axis=1),
            'Sleet': (df_ptype == 8).sum(axis=1),
            'Rain/Snow Mix': (df_ptype == 7).sum(axis=1),
            'Wet Snow': (df_ptype == 6).sum(axis=1),
            'Snow': (df_ptype == 5).sum(axis=1)
        }
        data_to_plot = [v / num_members * 100 for v in ptype_counts.values()]
        labels = list(ptype_counts.keys())
        colors = ['#2ca02c', '#9400D3', '#d62728', '#ff7f0e', '#17becf', '#1f77b4']
        ax2.stackplot(df_ptype.index, data_to_plot, labels=labels, colors=colors, alpha=0.8)
    
    ax2.set_title("Precipitation Type Likelihood")
    ax2.set_ylabel("Likelihood (%)")
    ax2.set_ylim(0, 100)
    ax2.legend(loc='upper left', fontsize='small')
    ax2.grid(True, which='both', linestyle='--', alpha=0.5)

    # --- Panel 3: Temperature ---
    df_temp_f = (df_temp * 9/5) + 32
    temp_mean = df_temp_f.mean(axis=1)
    p10 = df_temp_f.quantile(0.10, axis=1)
    p25 = df_temp_f.quantile(0.25, axis=1)
    p75 = df_temp_f.quantile(0.75, axis=1)
    p90 = df_temp_f.quantile(0.90, axis=1)
    
    ax3.fill_between(df_temp_f.index, p10, p90, color='blue', alpha=0.1, label='10-90th Percentile')
    ax3.fill_between(df_temp_f.index, p25, p75, color='blue', alpha=0.25, label='25-75th Percentile')
    ax3.plot(temp_mean.index, temp_mean, color='blue', linewidth=2, label='Mean')
    ax3.axhline(32, color='red', linestyle='--', alpha=0.7, label="Freezing")
    ax3.set_title("Ensemble 2m Temperature Forecast")
    ax3.set_ylabel("Temperature (°F)")
    ax3.legend(loc='upper right', fontsize='small')
    ax3.grid(True, which='both', linestyle='--', alpha=0.5)

    # --- Panel 4: Precipitation ---
    df_cum_precip_in = df_precip.cumsum() * 0.0393701
    precip_mean = df_cum_precip_in.mean(axis=1)
    for col in df_cum_precip_in.columns:
        ax4.plot(df_cum_precip_in.index, df_cum_precip_in[col], color='lightgray', alpha=0.4, linewidth=1)
    ax4.plot(precip_mean.index, precip_mean, color='black', linewidth=2.0, label='Mean')
    ax4.set_title("Ensemble Total Precipitation Forecast")
    ax4.set_ylabel("Accumulated Precip (inches)")
    ax4.legend(loc='upper left')
    ax4.grid(True, which='both', linestyle='--', alpha=0.5)

    # --- Panel 5: Wind ---
    wind_speed_mean = df_wind[[c for c in df_wind.columns if 'wind_speed' in c]].mean(axis=1)
    wind_gust_mean = df_wind[[c for c in df_wind.columns if 'wind_gusts' in c]].mean(axis=1)
    wind_dir_mean = df_wind[[c for c in df_wind.columns if 'wind_direction' in c]].mean(axis=1)

    ax5.fill_between(wind_speed_mean.index, wind_speed_mean, color="skyblue", alpha=0.4, label="Mean Speed")
    ax5.plot(wind_gust_mean.index, wind_gust_mean, color="steelblue", linewidth=1.5, label="Mean Gust")
    
    # Arrows
    arrow_interval = max(1, int(len(wind_dir_mean) / 30)) # prevent overcrowding
    for i in range(0, len(wind_dir_mean), arrow_interval):
        # Arrows point in direction wind is going (standard met arrows usually point into wind, 
        # but your script logic rotates based on "From" direction: 270 - deg + 180)
        rotation = 270 - wind_dir_mean.iloc[i] + 180
        ax5.text(wind_dir_mean.index[i], wind_speed_mean.iloc[i], '↑',
                 ha='center', va='center', rotation=rotation, fontsize=10, color='black')

    ax5.set_title("Ensemble Wind Forecast")
    ax5.set_ylabel("Speed (mph)")
    legend_patch = mpatches.Patch(color='none', label='↑ = Wind from S to N')
    handles, labels = ax5.get_legend_handles_labels()
    handles.append(legend_patch)
    labels.append('↑ = Wind from S to N')
    ax5.legend(handles=handles, labels=labels, loc='upper left', fontsize='small')
    ax5.grid(True, which='both', linestyle='--', alpha=0.5)

    # --- X-axis Formatting ---
    ax5.xaxis.set_major_locator(mdates.DayLocator(tz=target_tz))
    ax5.xaxis.set_major_formatter(mdates.DateFormatter('%a %m/%d', tz=target_tz))
    plt.xticks(rotation=45, ha='right')
    
    fig.suptitle(f"{forecast_days}-Day Forecast at Lat: {lat:.2f}, Lon: {lon:.2f}\nModel Run: {time_str}", fontsize=16)
    plt.tight_layout(rect=[0, 0.03, 1, 0.98])

    # Save to Buffer
    img_buffer = io.BytesIO()
    plt.savefig(img_buffer, format='png', dpi=120)
    img_buffer.seek(0)
    plt.close(fig)
    return img_buffer

# --- Route Definition ---

@stavrocast_bp.route('/plot')
def plot_route():
    # Get parameters from URL (e.g., ?lat=38.03&lon=-78.48&days=10)
    lat = request.args.get('lat', type=float)
    lon = request.args.get('lon', type=float)
    days = request.args.get('days', default=10, type=int)

    if lat is None or lon is None:
        abort(400, "Latitude and Longitude are required.")

    # Fetch Data
    data = get_euro_data(lat, lon, days)
    if not data:
        abort(502, "Failed to fetch data from Open-Meteo.")

    # Process Data
    df_temp, df_snow, df_ptype, df_precip, df_wind = process_data(data)
    
    if df_temp is None:
        abort(500, "Data processing failed.")

    # Create Image
    try:
        img = create_plot_buffer(df_temp, df_snow, df_ptype, df_precip, df_wind, lat, lon, days)
        return send_file(img, mimetype='image/png')
    except Exception as e:
        current_app.logger.error(f"Plotting Error: {e}")
        abort(500, "Failed to generate plot.")
