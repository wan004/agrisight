from flask import Blueprint, render_template

dashboard_bp = Blueprint('dashboard', __name__)


# ---------------------------------------------------------
# MAIN DASHBOARD PAGE
# ---------------------------------------------------------
@dashboard_bp.route('/')
def dashboard():
    return render_template('dashboard.html')

# ---------------------------------------------------------
# LOGS PAGE
# ---------------------------------------------------------
@dashboard_bp.route('/logs')
def logs():
    return render_template('logs.html')
