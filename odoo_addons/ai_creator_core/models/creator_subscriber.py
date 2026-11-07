from odoo import models, fields, api


class CreatorSubscriber(models.Model):
    _name = 'ai.creator.subscriber'
    _description = 'AI Creator Subscriber Tier Management'

    name = fields.Char(string='Creator Handle/Email', required=True)
    partner_id = fields.Many2one('res.partner', string='Related Partner')
    tier = fields.Selection([
        ('sfw_free', 'Tier 1: SFW Free'),
        ('nsfw_verified', 'Tier 2: NSFW Verified (Free)'),
        ('pro', 'Tier 3: Pro Monetizer ($49/mo)'),
        ('agency', 'Tier 4: Agency Fleet ($249/mo)')
    ], default='sfw_free', string='Subscription Tier')

    age_verified = fields.Boolean(string='Texas CUBI Age Verified', default=False)
    verification_token = fields.Char(string='Zero-Retention Age Token')

    compute_credits = fields.Integer(string='GPU Compute Credits Balance', default=100)
    crypto_wallet_override = fields.Char(string='Creator Payout Wallet (MetaMask)')
