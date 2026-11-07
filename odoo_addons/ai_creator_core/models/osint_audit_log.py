import hashlib

from odoo import models, fields, api


class OsintAuditLog(models.Model):
    _name = 'ai.osint.audit'
    _description = 'User OSINT Scan & Digital Footprint Logs'

    subscriber_id = fields.Many2one('ai.creator.subscriber', string='Subscriber')
    target_query = fields.Char(string='Target Queried', required=True)
    breach_count = fields.Integer(string='Pwned Breaches Detected', default=0)
    raw_scan_json = fields.Text(string='Raw Scan Results')
    c2pa_manifest_hash = fields.Char(string='C2PA Cryptographic Signature')

    @api.model
    def create(self, vals):
        # Auto-generate a deterministic C2PA manifest hash when the caller
        # does not supply one: sha256(target_query + timestamp).
        if not vals.get('c2pa_manifest_hash'):
            target_query = vals.get('target_query') or ''
            timestamp = str(fields.Datetime.now())
            vals['c2pa_manifest_hash'] = hashlib.sha256(
                (target_query + timestamp).encode('utf-8')
            ).hexdigest()
        return super(OsintAuditLog, self).create(vals)
