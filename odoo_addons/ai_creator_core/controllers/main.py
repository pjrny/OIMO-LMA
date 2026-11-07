import json

from odoo import http
from odoo.http import request


class AiCreatorController(http.Controller):

    @http.route('/api/v1/user/<int:user_id>', type='http', auth='none', methods=['GET'], csrf=False)
    def get_user_status(self, user_id, **kw):
        try:
            subscriber = request.env['ai.creator.subscriber'].sudo().search([('id', '=', user_id)], limit=1)
            if not subscriber:
                return request.make_response(json.dumps({'error': 'User not found'}), headers=[('Content-Type', 'application/json')])

            return request.make_response(json.dumps({
                'id': subscriber.id,
                'name': subscriber.name,
                'tier': subscriber.tier,
                'age_verified': subscriber.age_verified,
                'credits': subscriber.compute_credits
            }), headers=[('Content-Type', 'application/json')])
        except Exception as e:
            return request.make_response(
                json.dumps({'error': str(e)}),
                status=500,
                headers=[('Content-Type', 'application/json')]
            )

    @http.route('/api/v1/creator/onboard', type='http', auth='none', methods=['POST'], csrf=False)
    def onboard_creator(self, **kw):
        try:
            payload = json.loads(request.httprequest.data or '{}')
            name = payload.get('name')
            email = payload.get('email')
            tier = payload.get('tier', 'sfw_free')
            if not name or not email:
                return request.make_response(
                    json.dumps({'error': 'name and email are required'}),
                    status=400,
                    headers=[('Content-Type', 'application/json')]
                )
            subscriber = request.env['ai.creator.subscriber'].sudo().create({
                'name': name,
                'email': email,
                'tier': tier,
            })
            return request.make_response(
                json.dumps({'id': subscriber.id, 'name': subscriber.name, 'tier': subscriber.tier}),
                headers=[('Content-Type', 'application/json')]
            )
        except Exception as e:
            return request.make_response(
                json.dumps({'error': str(e)}),
                status=500,
                headers=[('Content-Type', 'application/json')]
            )

    @http.route('/api/v1/osint/log', type='http', auth='none', methods=['POST'], csrf=False)
    def log_osint_scan(self, **kw):
        try:
            payload = json.loads(request.httprequest.data or '{}')
            subscriber_id = payload.get('subscriber_id')
            target_query = payload.get('target_query')
            if not subscriber_id or not target_query:
                return request.make_response(
                    json.dumps({'error': 'subscriber_id and target_query are required'}),
                    status=400,
                    headers=[('Content-Type', 'application/json')]
                )
            log = request.env['ai.osint.audit'].sudo().create({
                'subscriber_id': int(subscriber_id),
                'target_query': target_query,
                'breach_count': int(payload.get('breach_count') or 0),
                'raw_scan_json': payload.get('raw_scan_json') or '',
            })
            return request.make_response(
                json.dumps({'id': log.id, 'c2pa_manifest_hash': log.c2pa_manifest_hash}),
                headers=[('Content-Type', 'application/json')]
            )
        except Exception as e:
            return request.make_response(
                json.dumps({'error': str(e)}),
                status=500,
                headers=[('Content-Type', 'application/json')]
            )
