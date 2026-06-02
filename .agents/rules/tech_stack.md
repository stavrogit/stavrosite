# Project Tech Stack Conventions

## Frontend (stavroscalos.com / Netlify)
* **HTML:** Ensure all HTML generated is strictly semantic and accessible. 
* **CSS Styling:** Never use inline CSS; always rely on the external stylesheets. Specifically, use `assets/css/main.css` for primary styling.
* **JavaScript:** Write clean, vanilla JavaScript (unless otherwise specified). 

## Backend (PythonAnywhere)
* **Python Standards:** Always utilize Python type hinting for backend scripts.
* **Deployment:** Changes made to backend Python scripts must eventually be pulled to the PythonAnywhere environment and the web app reloaded in the "Web" tab.

## Version Control Golden Rule
* NEVER commit directly to the `main` branch. 
* Always confirm you are branching off `development` before starting new feature work.