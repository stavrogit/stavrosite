from flask import Flask
from flask_cors import CORS
from backend.stavrocast_app.routes import stavrocast_bp

def create_app():
    # Initialize the main Flask application
    app = Flask(__name__)
    
    # Enable CORS for all domains (allows your Netlify frontend to talk to this)
    CORS(app)
    
    # Register the Stavrocast Blueprint
    # All routes in the blueprint will be prefixed with /stavrocast
    # e.g., /plot becomes /stavrocast/plot
    app.register_blueprint(stavrocast_bp, url_prefix='/stavrocast')
    
    return app

# Create the application instance
app = create_app()

if __name__ == "__main__":
    app.run(debug=True)
