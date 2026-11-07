import os
import xmlrpc.client
from flask import Flask, request, jsonify

app = Flask(__name__)

ODOO_URL = os.getenv('ODOO_DATABASE_URL_1', 'http://localhost:8069')
ODOO_DB = os.getenv('ODOO_DB_NAME', 'odoo')
ODOO_USER = os.getenv('ODOO_USER', 'admin')
ODOO_PASS = os.getenv('ODOO_API_URL_1', 'admin')

def get_odoo_connection():
    common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
    uid = common.authenticate(ODOO_DB, ODOO_USER, ODOO_PASS, {})
    models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
    return uid, models

@app.route('/mcp/odoo/subscribers', methods=['GET'])
def list_subscribers():
    try:
        uid, models = get_odoo_connection()
        subscribers = models.execute_kw(
            ODOO_DB, uid, ODOO_PASS,
            'ai.creator.subscriber', 'search_read',
            [[]],
            {'fields': ['name', 'tier', 'compute_credits', 'age_verified']}
        )
        return jsonify({'status': 'success', 'data': subscribers})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/mcp/odoo/add-credits', methods=['POST'])
def add_credits():
    data = request.json
    subscriber_id = data.get('subscriber_id')
    credits_to_add = data.get('credits', 50)

    try:
        uid, models = get_odoo_connection()
        subscriber = models.execute_kw(
            ODOO_DB, uid, ODOO_PASS,
            'ai.creator.subscriber', 'read',
            [[subscriber_id]], {'fields': ['compute_credits']}
        )
        if subscriber:
            current_credits = subscriber[0]['compute_credits']
            models.execute_kw(
                ODOO_DB, uid, ODOO_PASS,
                'ai.creator.subscriber', 'write',
                [[subscriber_id], {'compute_credits': current_credits + credits_to_add}]
            )
            return jsonify({'status': 'success', 'new_balance': current_credits + credits_to_add})
        return jsonify({'status': 'error', 'message': 'Subscriber not found'}), 404
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/mcp/odoo/audit-logs', methods=['GET'])
def list_audit_logs():
    subscriber_id = request.args.get('subscriber_id')
    try:
        uid, models = get_odoo_connection()
        domain = [('subscriber_id', '=', int(subscriber_id))] if subscriber_id else [[]]
        logs = models.execute_kw(
            ODOO_DB, uid, ODOO_PASS,
            'ai.osint.audit', 'search_read',
            [domain],
            {'fields': ['subscriber_id', 'target_query', 'breach_count', 'raw_scan_json', 'c2pa_manifest_hash']}
        )
        return jsonify({'status': 'success', 'data': logs})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    print("Starting Argon Odoo-MCP Bridge on Port 5050...")
    app.run(host='0.0.0.0', port=5050)
