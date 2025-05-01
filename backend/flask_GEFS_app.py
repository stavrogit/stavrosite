# === Imports ===
import pandas as pd
import matplotlib
matplotlib.use('Agg') # Use non-interactive backend suitable for servers
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import numpy as np
import pytz
import os
import requests
import io # Needed for in-memory image
import traceback
from datetime import datetime, timedelta, timezone
from flask import Flask, send_file, jsonify, abort # Added Flask imports
from flask_cors import CORS # Added CORS import

# === Flask App Setup ===
app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# --- Constants ---
# (Keep all your existing constants: BASE_URL, TARGET_TIMEZONE, etc.)
BASE_URL = 'https://www.emc.ncep.noaa.gov/users/meg/gefs_plumes/'
TARGET_TIMEZONE = 'US/Eastern'
MODEL_UPDATE_HOURS = [0, 6, 12, 18]
CSV_DATE_FORMAT = '%m-%d-%Y:%H'
TEXT_DATE_FORMAT = '%a %Y/%m/%d, %H:%M'
AXIS_TICK_DATE_FORMAT = '%a %m/%d; %H:%M'

TEMP_FILE_SUFFIX = '2mt'
PRECIP_FILE_SUFFIX = 'qpf3h'

INTENSITY_THRESHOLDS = {
    'Very Heavy': 1.00, 'Heavy': 0.30, 'Moderate': 0.10, 'Light': 0.05, 'Trace': 0.01,
}
INTENSITY_LEGEND_LABELS = {
    'Very Heavy': f'Very Heavy (>= {INTENSITY_THRESHOLDS["Very Heavy"]:.2f} in/3hr)',
    'Heavy': f'Heavy ({INTENSITY_THRESHOLDS["Heavy"]:.2f} - {INTENSITY_THRESHOLDS["Very Heavy"]:.2f} in/3hr)',
    'Moderate': f'Moderate ({INTENSITY_THRESHOLDS["Moderate"]:.2f} - {INTENSITY_THRESHOLDS["Heavy"]:.2f} in/3hr)',
    'Light': f'Light ({INTENSITY_THRESHOLDS["Light"]:.2f} - {INTENSITY_THRESHOLDS["Moderate"]:.2f} in/3hr)',
    'Trace': f'Trace ({INTENSITY_THRESHOLDS["Trace"]:.2f} - {INTENSITY_THRESHOLDS["Light"]:.2f} in/3hr)'
}
# Colors ordered Red -> Blue to match Very Heavy -> Trace stack order
INTENSITY_COLORS = ['red', 'darkorange', 'yellow', 'mediumseagreen', 'lightblue']


TEMP_PERCENTILES = [0.10, 0.25, 0.75, 0.90] # Removed 0.50 as we now plot mean
# Temperature Colors: Shades of Red for percentiles
TEMP_COLOR_10_90 = 'lightcoral'; TEMP_ALPHA_10_90 = 0.3
TEMP_COLOR_25_75 = 'indianred'; TEMP_ALPHA_25_75 = 0.4
# Color for the Mean Temperature line
TEMP_MEAN_COLOR = 'red'
PRECIP_ENSEMBLE_ALPHA = 0.6

PLOT_DPI = 300 # Keep DPI reasonable for web use
REQUEST_TIMEOUT = 30
# Removed FILENAME_SUFFIX and FILENAME_SEP as we don't save to a named file anymore


# --- Functions ---
# (Keep most of your existing functions: get_latest_update_time, construct_url, etc.)
# REMOVED: prompt_airport_code() - Input now comes from the web request

def get_latest_update_time():
    """Determines the most recent GEFS model run time (UTC)."""
    # Use timezone-aware datetime.now(timezone.utc) instead of deprecated utcnow()
    now_utc = datetime.now(timezone.utc)
    current_hour_utc = now_utc.hour
    # Find the latest model run hour that has passed
    latest_update_hour = max(h for h in MODEL_UPDATE_HOURS if h <= current_hour_utc)
    # Construct the datetime object for the latest run
    # Ensure the resulting time is timezone-aware (UTC)
    latest_update_time = now_utc.replace(hour=latest_update_hour, minute=0, second=0, microsecond=0)
    return latest_update_time

def construct_url(airport_code, update_time, file_type_suffix):
    """Constructs the download URL."""
    file_name = f'GEFSK{airport_code.upper()}{update_time.strftime("%Y%m%d%H")}{file_type_suffix}.csv'
    return BASE_URL + file_name

def load_csv_file(airport_code, file_type_suffix):
    """Downloads a specific GEFS plume data CSV with fallback."""
    latest_update = get_latest_update_time()
    runs_to_try = [
        {'time': latest_update, 'url': construct_url(airport_code, latest_update, file_type_suffix)},
        {'time': latest_update - timedelta(hours=6), 'url': construct_url(airport_code, latest_update - timedelta(hours=6), file_type_suffix)}
    ]
    loaded_url = None; successful_update_time = None
    for run in runs_to_try:
        url = run['url']; update_time = run['time']
        app.logger.info(f"Attempting {file_type_suffix} from: {url}") # Use app.logger for server logs
        try:
            response = requests.get(url, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            app.logger.info(f"Success: {url}")
            csv_data = io.StringIO(response.text)
            df = pd.read_csv(csv_data)
            return df, url, update_time # Return the successful update time
        except Exception as e:
             app.logger.error(f"Failed: {url}. Error: {e}") # Log errors
    app.logger.error(f"Failed to retrieve {file_type_suffix} data for {airport_code}.")
    return None, None, None # Return None if all attempts fail

def convert_to_eastern_time(df):
    """Converts 'date' column to timezone-aware 'datetime' column."""
    if df is None or 'date' not in df.columns: return df
    try:
        df['date'] = df['date'].astype(str)
        dt_naive = pd.to_datetime(df['date'], format=CSV_DATE_FORMAT)
        # Localize naive datetime objects as UTC
        dt_utc = dt_naive.dt.tz_localize('UTC')
        eastern = pytz.timezone(TARGET_TIMEZONE)
        # Convert UTC times to Eastern Time
        df['datetime'] = dt_utc.dt.tz_convert(eastern)
    except Exception as e:
        app.logger.error(f"Err converting date: {e}. Assign NaT.")
        df['datetime'] = pd.NaT
    return df

def categorize_intensity(value):
    """Categorizes a 3-hour precipitation value (inches)."""
    if not isinstance(value, (int, float)) or pd.isna(value): return 'No Rain'
    for category, threshold in INTENSITY_THRESHOLDS.items():
        if value >= threshold: return category
    if value > 0: return 'Trace'
    return 'No Rain'

# --- Plotting Function (Modified) ---
def create_graphs(airport_code,
                  df_temp, model_cols_temp, url_temp,
                  df_precip, model_cols_precip, url_precip):
                  # REMOVED: output_file parameter
    """Generates the forecast plots and returns as in-memory bytes."""

    # --- Determine Time Axis ---
    # Prioritize temp data for time axis if available and valid, otherwise use precip
    df_time_ref = df_temp if df_temp is not None and 'datetime' in df_temp.columns and not df_temp['datetime'].isnull().all() else df_precip
    time_axis = None
    et_tz = pytz.timezone(TARGET_TIMEZONE) # Default timezone

    if df_time_ref is not None and 'datetime' in df_time_ref.columns and not df_time_ref['datetime'].isnull().all():
        time_axis = df_time_ref['datetime']
        # Try to get the exact timezone from the data if it exists
        if hasattr(time_axis.dt, 'tz') and time_axis.dt.tz:
             et_tz = time_axis.dt.tz
        # Ensure time_axis is usable (convert NaT to None or handle appropriately)
        # This example proceeds assuming NaT rows might exist but overall axis is valid
    else:
        app.logger.error("Error: Could not establish a valid datetime axis for plotting.")
        return None # Indicate error

    # --- Figure Setup ---
    fig = plt.figure(figsize=(12, 19)) # Keep figure size
    gs = fig.add_gridspec(4, 1, height_ratios=[0.15, 1, 1, 1]) # Adjusted grid spec if needed

    # --- Header Text ---
    ax_text = fig.add_subplot(gs[0])
    ax_text.axis('off')
    try:
        # Check if time_axis is valid and not empty before accessing iloc[0]
        if time_axis is not None and not time_axis.empty and pd.notna(time_axis.iloc[0]):
             first_date_et = time_axis.iloc[0]
             first_date_zulu = first_date_et.tz_convert('UTC')
             et_str = first_date_et.strftime(TEXT_DATE_FORMAT)
             zulu_str = first_date_zulu.strftime(TEXT_DATE_FORMAT)
             line1 = f"10 day Forecast at {airport_code.upper()} Airport\n"
             line2 = f"GEFS Model Run: {et_str} ET ({zulu_str} Z)"
             ax_text.text(0.5, 0.80, line1.strip(), ha='center', va='center', fontsize=13, fontweight='bold', transform=ax_text.transAxes)
             ax_text.text(0.5, 0.35, line2.strip(), ha='center', va='center', fontsize=9, transform=ax_text.transAxes)
        else:
            raise ValueError("First datetime value is invalid or missing.")
    except Exception as e:
        app.logger.warning(f"Warn: Header text error: {e}")
        ax_text.text(0.5, 0.5, "Header Info Unavailable", ha='center', va='center')


    # --- Plotting Axes ---
    ax_precip_cum = fig.add_subplot(gs[1])
    ax_precip_int = fig.add_subplot(gs[2])
    ax_temp = fig.add_subplot(gs[3])

    # --- Axis Formatting Function ---
    def format_xaxis(ax, time_values):
        """Formats date axis - original style with rotation."""
        if time_values is None or time_values.empty or time_values.isnull().all():
             ax.set_xlabel('Date (Eastern Time)')
             ax.text(0.5, 0.5, "Time Axis Error", ha='center', va='center', transform=ax.transAxes)
             return

        # Ensure time_values are suitable for matplotlib's date functions
        # Convert pandas Timestamps to matplotlib-compatible format if necessary
        # For simplicity, assuming direct use works, but might need conversion like:
        # time_values_mpl = mdates.date2num(time_values.to_pydatetime())

        ax.xaxis.set_major_locator(mdates.DayLocator(interval=1, tz=et_tz))
        ax.xaxis.set_minor_locator(mdates.HourLocator(byhour=[0, 6, 12, 18], tz=et_tz))

        def format_date(x, pos=None):
             try:
                 # Convert matplotlib num back to datetime, make timezone aware
                 date_obj = mdates.num2date(x)
                 # Assume the num is UTC if no tzinfo, otherwise use its info and convert
                 if date_obj.tzinfo is None:
                      date = pytz.utc.localize(date_obj).astimezone(et_tz)
                 else:
                      date = date_obj.astimezone(et_tz)

                 if date.hour == 0:
                      return date.strftime(AXIS_TICK_DATE_FORMAT)
                 else:
                      return ''
             except Exception as e:
                 app.logger.debug(f"Date formatting error: {e}")
                 return ''

        ax.xaxis.set_major_formatter(plt.FuncFormatter(format_date))
        ax.tick_params(axis='x', which='major', length=10, width=1.5)
        ax.tick_params(axis='x', which='minor', length=5, width=1)
        plt.setp(ax.xaxis.get_majorticklabels(), rotation=45, ha='right', fontsize=8)
        ax.grid(which='major', axis='x', linestyle='-', linewidth=0.7, alpha=0.7)
        ax.grid(which='minor', axis='x', linestyle=':', alpha=0.5)
        ax.grid(which='major', axis='y', linestyle=':', alpha=0.5)
        ax.set_xlabel('Date (Eastern Time)')
        try:
            ax.set_xlim(time_values.min(), time_values.max()) # Use pandas min/max directly
        except Exception as e:
            app.logger.warning(f"Could not set xlim: {e}")


    # --- Plotting Logic (Conditional) ---
    plot_error_text = "Error generating plot"
    data_unavailable_text = "Data Unavailable"

    # Plot 1: Cumulative Precipitation
    if df_precip is not None and model_cols_precip and time_axis is not None:
        ax = ax_precip_cum
        try:
            cumulative_precip = df_precip[model_cols_precip].cumsum()
            if cumulative_precip.isnull().all().all(): raise ValueError("Cumulative precip data is all null")
            # Plotting individual ensemble members
            for col in model_cols_precip:
                if col in cumulative_precip.columns:
                    # Ensure alignment with time_axis, especially if lengths differ or NaNs exist
                    ax.plot(time_axis, cumulative_precip[col], color='darkgrey', alpha=PRECIP_ENSEMBLE_ALPHA, lw=0.8)
            # Calculate and plot mean
            avg_cumulative = cumulative_precip.mean(axis=1)
            mean_line, = ax.plot(time_axis, avg_cumulative, color='black', lw=2, label='Mean')

            ax.set_title('Cumulative Precipitation'); ax.set_ylabel('Total Accumulation (inches)')
            format_xaxis(ax, time_axis) # Pass the time_axis used for plotting
            ensemble_proxy = plt.Line2D([0], [0], color='darkgrey', lw=0.8, alpha=PRECIP_ENSEMBLE_ALPHA, label='Ensemble Members')
            ax.legend(handles=[mean_line, ensemble_proxy], loc='upper left', fontsize='small')
        except Exception as e:
             app.logger.error(f"Err precip cum plot: {e}\n{traceback.format_exc()}")
             ax.text(0.5, 0.5, plot_error_text, ha='center', va='center', transform=ax.transAxes)
             format_xaxis(ax, time_axis) # Still format axis even on error
    else:
        ax_precip_cum.text(0.5, 0.5, data_unavailable_text, ha='center', va='center', transform=ax_precip_cum.transAxes)
        ax_precip_cum.set_title('Cumulative Precipitation')
        format_xaxis(ax_precip_cum, time_axis) # Format axis even if no data


    # Plot 2: Precipitation Intensity Distribution
    if df_precip is not None and model_cols_precip and time_axis is not None:
        ax = ax_precip_int
        try:
            cats = list(INTENSITY_LEGEND_LABELS.values())
            cat_map = {k: l for k, l in INTENSITY_LEGEND_LABELS.items()}
            data = {l: [] for l in cats}
            n_mem = len(model_cols_precip)

            if n_mem > 0:
                # Align df_precip index with time_axis if necessary, though usually they match
                # Iterate through time_axis to ensure correct length and handle potential NaNs
                for i, timestamp in enumerate(time_axis):
                     if pd.notnull(timestamp) and i < len(df_precip):
                         row_values = pd.to_numeric(df_precip.iloc[i][model_cols_precip], errors='coerce')
                         intensities = [categorize_intensity(v) for v in row_values]
                         counts = {intensity_key: intensities.count(intensity_key) for intensity_key in INTENSITY_THRESHOLDS.keys()}
                         for intensity_key, count in counts.items():
                              legend_label = cat_map[intensity_key]
                              data[legend_label].append(count / n_mem * 100)
                     else:
                          # Append NaN if timestamp is invalid or index out of bounds
                          for l in cats:
                              data[l].append(np.nan)
            else:
                # If no model columns, fill with zeros matching time_axis length
                for l in cats:
                     data[l] = [0.0] * len(time_axis)


            # Prepare data for stackplot, ensuring alignment with valid time_axis points
            valid_idx = time_axis.notna()
            filt_time = time_axis[valid_idx]

            # Filter stack data corresponding to valid timestamps
            filt_stack = []
            for l in cats:
                 # Ensure data[l] has the same length as time_axis before filtering
                 if len(data[l]) == len(time_axis):
                      filt_stack.append([v for i, v in enumerate(data[l]) if valid_idx.iloc[i]])
                 else:
                      # Handle length mismatch - log warning or fill with NaNs/zeros
                      app.logger.warning(f"Length mismatch for category {l}")
                      # Example: fill with NaN for safety
                      filt_stack.append([np.nan] * len(filt_time))


            # Check if there's any valid data to plot
            if not filt_time.empty and any(any(np.nan_to_num(d) > 0) for d in filt_stack): # Check for actual data > 0
                ax.stackplot(filt_time, filt_stack, labels=cats, colors=INTENSITY_COLORS, alpha=0.9)
            else:
                 raise ValueError("No valid data for intensity stackplot.")

            ax.set_title('Precipitation Intensity Distribution')
            ax.set_ylabel('Percentage of Models (%)')
            ax.set_ylim(0, 100)
            format_xaxis(ax, time_axis)
            handles = [plt.Rectangle((0, 0), 1, 1, fc=color) for color in reversed(INTENSITY_COLORS)]
            labels = list(reversed(cats))
            ax.legend(handles, labels, loc='upper right', fontsize='small', title="Intensity Categories")

        except Exception as e:
            app.logger.error(f"Err precip int plot: {e}\n{traceback.format_exc()}")
            ax.text(0.5, 0.5, plot_error_text, ha='center', va='center', transform=ax.transAxes)
            format_xaxis(ax, time_axis) # Format axis even on error
    else:
        ax_precip_int.text(0.5, 0.5, data_unavailable_text, ha='center', va='center', transform=ax_precip_int.transAxes)
        ax_precip_int.set_title('Precipitation Intensity Distribution')
        format_xaxis(ax_precip_int, time_axis) # Format axis even if no data


    # Plot 3: Temperature Mean and Percentiles
    if df_temp is not None and model_cols_temp and time_axis is not None:
        ax = ax_temp
        try:
            # Calculate Mean Temperature
            mean_temp = df_temp[model_cols_temp].mean(axis=1)
            # Calculate Percentiles
            p_data = df_temp[model_cols_temp].quantile(q=TEMP_PERCENTILES, axis=1)

            # Check if calculations resulted in all NaNs
            if p_data.isnull().all().all() or mean_temp.isnull().all():
                 raise ValueError("Percentile or mean temperature calculation resulted in all NaNs.")

            p10=p_data.loc[0.10]; p25=p_data.loc[0.25]; p75=p_data.loc[0.75]; p90=p_data.loc[0.90]

            # Plot Percentile Ranges - ensure alignment with time_axis
            ax.fill_between(time_axis, p10, p90, color=TEMP_COLOR_10_90, alpha=TEMP_ALPHA_10_90, label='10-90th Percentile Range')
            ax.fill_between(time_axis, p25, p75, color=TEMP_COLOR_25_75, alpha=TEMP_ALPHA_25_75, label='25-75th Percentile Range')
            # Plot Mean Temperature
            ax.plot(time_axis, mean_temp, color=TEMP_MEAN_COLOR, lw=1.5, label='Mean')

            ax.set_title('Ensemble 2m Temperature Forecast')
            ax.set_ylabel('Temperature (°F)')
            format_xaxis(ax, time_axis)
            ax.legend(loc='best', fontsize='small')

        except Exception as e:
            app.logger.error(f"Err temp plot: {e}\n{traceback.format_exc()}")
            ax.text(0.5, 0.5, plot_error_text, ha='center', va='center', transform=ax.transAxes)
            format_xaxis(ax, time_axis) # Format axis even on error
    else:
        ax_temp.text(0.5, 0.5, data_unavailable_text, ha='center', va='center', transform=ax_temp.transAxes)
        ax_temp.set_title('Ensemble 2m Temperature Forecast')
        format_xaxis(ax_temp, time_axis) # Format axis even if no data


    # --- Footer Text (Source URLs) ---
    try:
        temp_url_str = f"Temperature data source: {url_temp if url_temp else 'N/A'}"
        precip_url_str = f"Precipitation data source: {url_precip if url_precip else 'N/A'}"
        # Adjust positioning slightly if needed
        fig.text(0.01, 0.03, temp_url_str, ha='left', va='bottom', fontsize=7, color='gray', wrap=True)
        fig.text(0.01, 0.015, precip_url_str, ha='left', va='bottom', fontsize=7, color='gray', wrap=True)
    except Exception as e:
        app.logger.warning(f"Warn: Footer text error: {e}")

    # --- Final Layout Adjustments ---
    # Adjust bottom more to accommodate rotated labels and footer text
    plt.subplots_adjust(left=0.08, right=0.95, bottom=0.15, top=0.94, hspace=0.6)

    # --- Save Figure to Buffer ---
    img_buffer = io.BytesIO()
    try:
        plt.savefig(img_buffer, format='png', dpi=PLOT_DPI, bbox_inches='tight')
        img_buffer.seek(0) # Rewind buffer to the beginning
        app.logger.info(f"Graph created successfully in memory for {airport_code}")
        return img_buffer # Return the buffer containing the image
    except Exception as e:
        app.logger.error(f"Error saving plot to buffer: {e}")
        return None # Indicate error
    finally:
        plt.close(fig) # Close the figure to free memory


# --- Flask Route ---
@app.route('/plot/<airport_code>')
def get_weather_plot(airport_code):
    """
    API endpoint to generate and return the weather plot for a given airport code.
    """
    app.logger.info(f"Received request for airport code: {airport_code}")

    # Validate airport code format (basic check)
    if not airport_code or not (3 <= len(airport_code) <= 4) or not airport_code.isalnum():
         app.logger.warning(f"Invalid airport code format received: {airport_code}")
         abort(400, description="Invalid airport code format. Please use 3 or 4 alphanumeric characters.")


    df_temp = df_precip = None
    url_temp = url_precip = None
    model_cols_temp = model_cols_precip = []
    update_time_temp = update_time_precip = None

    try:
        # --- Load Data ---
        app.logger.info("\n--- Loading Temp Data ---")
        df_temp, url_temp, update_time_temp = load_csv_file(airport_code, TEMP_FILE_SUFFIX)

        app.logger.info("\n--- Loading Precip Data ---")
        df_precip, url_precip, update_time_precip = load_csv_file(airport_code, PRECIP_FILE_SUFFIX)

        if df_temp is None and df_precip is None:
            app.logger.error(f"Failed: No data loaded for {airport_code}.")
            # Return a 404 Not Found or a specific error message
            abort(404, description=f"Could not retrieve weather data for airport code: {airport_code}. Please check the code or try again later.")


        # --- Process Data ---
        processed_data = {}
        data_to_process = [(df_temp, 'Temp'), (df_precip, 'Precip')]

        for df, name in data_to_process:
            if df is not None:
                app.logger.info(f"\n--- Processing {name} Data ---")
                df = convert_to_eastern_time(df)
                if 'datetime' in df.columns and not df['datetime'].isnull().all():
                    # Identify model columns (assuming first 2 are metadata, last 2 date/datetime)
                    try:
                         # Ensure enough columns exist before slicing
                         if df.shape[1] > 4:
                              model_cols = df.columns[2:-2].tolist()
                              if not model_cols:
                                  app.logger.warning(f"Warn: {name} model col slice [2:-2] empty.")
                              else:
                                  app.logger.info(f"{name} models: {len(model_cols)}")
                                  # Convert model columns to numeric, coercing errors
                                  for col in model_cols:
                                      if col in df.columns:
                                          df[col] = pd.to_numeric(df[col], errors='coerce')
                              processed_data[name] = {'df': df, 'cols': model_cols}
                         else:
                              app.logger.error(f"Error: {name} DataFrame has too few columns ({df.shape[1]}) for slicing [2:-2].")
                              processed_data[name] = {'df': None, 'cols': []}

                    except IndexError:
                        app.logger.error(f"Error processing columns for {name} DataFrame.")
                        processed_data[name] = {'df': None, 'cols': []}
                else:
                     app.logger.warning(f"Warn: {name} time processing failed or resulted in no valid datetimes.")
                     processed_data[name] = {'df': None, 'cols': []} # Mark as failed if time conversion fails
            else:
                processed_data[name] = {'df': None, 'cols': []}

        df_temp = processed_data.get('Temp', {}).get('df')
        model_cols_temp = processed_data.get('Temp', {}).get('cols', [])
        df_precip = processed_data.get('Precip', {}).get('df')
        model_cols_precip = processed_data.get('Precip', {}).get('cols', [])


        # --- Create Graphs ---
        app.logger.info("\n--- Creating Graphs ---")
        image_buffer = create_graphs(airport_code,
                                     df_temp, model_cols_temp, url_temp,
                                     df_precip, model_cols_precip, url_precip)

        if image_buffer:
            return send_file(
                image_buffer,
                mimetype='image/png', # Explicitly set MIME type
                as_attachment=False # Display inline
            )
        else:
            app.logger.error(f"Graph generation failed for {airport_code}.")
            abort(500, description="Failed to generate the weather plot.")

    except requests.exceptions.RequestException as e:
         app.logger.error(f"Network error fetching data for {airport_code}: {e}")
         abort(502, description="Could not connect to the weather data source.")
    except Exception as e:
        app.logger.error(f"\nUnexpected error processing request for {airport_code}: {str(e)}\n{traceback.format_exc()}")
        # Generic error for the user
        abort(500, description="An internal server error occurred.")

# Note: The section `if __name__ == "__main__":` is removed
# Flask apps are typically run using a WSGI server (like gunicorn or waitress)
# or Flask's built-in server for development (`flask run`).
# On PythonAnywhere, you configure the WSGI file to point to the 'app' object.