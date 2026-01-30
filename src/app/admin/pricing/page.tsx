'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  DollarSign, 
  ArrowLeft, 
  Save, 
  RefreshCw,
  Check,
  AlertCircle,
  Euro,
  Plus,
  Trash2,
  Edit2
} from 'lucide-react';

interface PlanPrice {
  monthly: number;
  yearly: number;
}

interface Plan {
  id: string;
  name: string;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  price: Record<string, PlanPrice>;
  description: string;
  features: string[];
  limits: {
    minutes: number;
    languages: number;
    countries: number;
    integrations: number;
  };
  cta: string;
  popular: boolean;
}

interface PricingData {
  version: number;
  updated_at: string;
  default_currency: string;
  plans: Plan[];
  addons: any[];
  billing: {
    yearly_discount_percent: number;
  };
  country_currency_map: Record<string, string>;
  currency_symbols: Record<string, string>;
}

export default function PricingEditor() {
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('EUR');

  const fetchPricing = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pricing/admin');
      if (res.ok) {
        const data = await res.json();
        setPricing(data);
      }
    } catch (error) {
      console.error('Error fetching pricing:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPricing();
  }, []);

  const savePricing = async () => {
    if (!pricing) return;
    
    setSaving(true);
    setSaveStatus('idle');
    
    try {
      const res = await fetch('/api/pricing/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pricing),
      });
      
      if (res.ok) {
        const data = await res.json();
        setSaveStatus('success');
        // Refresh to get updated version
        await fetchPricing();
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Error saving pricing:', error);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const updatePlanPrice = (planId: string, currency: string, field: 'monthly' | 'yearly', value: number) => {
    if (!pricing) return;
    
    setPricing({
      ...pricing,
      plans: pricing.plans.map(plan => 
        plan.id === planId 
          ? {
              ...plan,
              price: {
                ...plan.price,
                [currency]: {
                  ...plan.price[currency],
                  [field]: value
                }
              }
            }
          : plan
      )
    });
  };

  const updatePlanField = (planId: string, field: string, value: any) => {
    if (!pricing) return;
    
    setPricing({
      ...pricing,
      plans: pricing.plans.map(plan => 
        plan.id === planId ? { ...plan, [field]: value } : plan
      )
    });
  };

  const currencies = pricing ? Object.keys(pricing.currency_symbols) : ['EUR', 'USD', 'GBP'];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-[#ccff00]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="h-16 bg-[#111] border-b border-[#222] flex items-center justify-between px-6 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Pricing Editor</h1>
              <p className="text-xs text-gray-500">
                Version {pricing?.version || '-'} • Last update: {pricing?.updated_at ? new Date(pricing.updated_at).toLocaleString() : '-'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-[#333] rounded-lg overflow-hidden">
            {currencies.map((currency) => (
              <button
                key={currency}
                onClick={() => setSelectedCurrency(currency)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedCurrency === currency 
                    ? 'bg-[#ccff00] text-black' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {currency}
              </button>
            ))}
          </div>
          
          <button
            onClick={savePricing}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ccff00] text-black font-medium hover:bg-[#b3e600] transition-colors disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : saveStatus === 'success' ? (
              <Check className="w-4 h-4" />
            ) : saveStatus === 'error' ? (
              <AlertCircle className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="p-6 max-w-7xl mx-auto">
        {/* Plans */}
        <h2 className="text-xl font-semibold mb-4">Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {pricing?.plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-[#111] border rounded-xl p-6 ${
                plan.popular ? 'border-[#ccff00]' : 'border-[#222]'
              }`}
            >
              {plan.popular && (
                <div className="bg-[#ccff00] text-black text-xs font-bold px-3 py-1 rounded-full inline-block mb-4">
                  Most Popular
                </div>
              )}
              
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <button
                  onClick={() => updatePlanField(plan.id, 'popular', !plan.popular)}
                  className={`text-xs px-2 py-1 rounded ${
                    plan.popular 
                      ? 'bg-[#ccff00]/20 text-[#ccff00]' 
                      : 'bg-gray-500/20 text-gray-400'
                  }`}
                >
                  {plan.popular ? 'Popular' : 'Mark Popular'}
                </button>
              </div>

              <p className="text-sm text-gray-400 mb-6">{plan.description}</p>

              {/* Pricing inputs */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Monthly Price ({selectedCurrency})</label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{pricing?.currency_symbols[selectedCurrency]}</span>
                    <input
                      type="number"
                      value={plan.price[selectedCurrency]?.monthly || 0}
                      onChange={(e) => updatePlanPrice(plan.id, selectedCurrency, 'monthly', Number(e.target.value))}
                      className="flex-1 bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-xl font-bold focus:border-[#ccff00] focus:outline-none"
                    />
                    <span className="text-gray-500 text-sm">/mo</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Yearly Price ({selectedCurrency})</label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{pricing?.currency_symbols[selectedCurrency]}</span>
                    <input
                      type="number"
                      value={plan.price[selectedCurrency]?.yearly || 0}
                      onChange={(e) => updatePlanPrice(plan.id, selectedCurrency, 'yearly', Number(e.target.value))}
                      className="flex-1 bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-lg focus:border-[#ccff00] focus:outline-none"
                    />
                    <span className="text-gray-500 text-sm">/yr</span>
                  </div>
                </div>
              </div>

              {/* Limits */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Minutes</label>
                  <input
                    type="number"
                    value={plan.limits.minutes}
                    onChange={(e) => updatePlanField(plan.id, 'limits', { ...plan.limits, minutes: Number(e.target.value) })}
                    className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm focus:border-[#ccff00] focus:outline-none"
                    placeholder="-1 for unlimited"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Languages</label>
                  <input
                    type="number"
                    value={plan.limits.languages}
                    onChange={(e) => updatePlanField(plan.id, 'limits', { ...plan.limits, languages: Number(e.target.value) })}
                    className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm focus:border-[#ccff00] focus:outline-none"
                  />
                </div>
              </div>

              {/* Features */}
              <div>
                <label className="block text-xs text-gray-500 mb-2">Features</label>
                <div className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-[#ccff00] shrink-0" />
                      <span className="text-sm text-gray-300">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stripe IDs */}
              <div className="mt-6 pt-4 border-t border-[#222]">
                <label className="block text-xs text-gray-500 mb-2">Stripe Price ID (Monthly)</label>
                <input
                  type="text"
                  value={plan.stripe_price_id_monthly || ''}
                  onChange={(e) => updatePlanField(plan.id, 'stripe_price_id_monthly', e.target.value || null)}
                  placeholder="price_xxxxx"
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-xs text-gray-400 focus:border-[#ccff00] focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Preview Section */}
        <h2 className="text-xl font-semibold mb-4">Preview</h2>
        <div className="bg-[#111] border border-[#222] rounded-xl p-6">
          <p className="text-sm text-gray-400 mb-4">
            This is how pricing will appear on Sito Agoralia and App Agoralia:
          </p>
          
          <div className="flex gap-4 overflow-x-auto pb-4">
            {pricing?.plans.map((plan) => (
              <div
                key={plan.id}
                className={`min-w-[280px] border rounded-2xl p-6 ${
                  plan.popular 
                    ? 'border-[#ccff00] bg-[#ccff00]/5' 
                    : 'border-[#333] bg-[#0a0a0a]'
                }`}
              >
                {plan.popular && (
                  <div className="bg-[#ccff00] text-black text-xs font-bold px-3 py-1 rounded-full inline-block mb-4">
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <p className="text-sm text-gray-400 mt-1">{plan.description}</p>
                <div className="mt-4">
                  <span className="text-3xl font-bold">
                    {pricing?.currency_symbols[selectedCurrency]}
                    {plan.price[selectedCurrency]?.monthly || 0}
                  </span>
                  <span className="text-gray-500">/month</span>
                </div>
                <button className={`w-full mt-4 py-2 rounded-lg font-medium ${
                  plan.popular 
                    ? 'bg-[#ccff00] text-black' 
                    : 'bg-[#222] text-white'
                }`}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* API Endpoint Info */}
        <div className="mt-8 bg-[#111] border border-[#222] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">API Endpoints</h3>
          <div className="space-y-4 text-sm">
            <div>
              <code className="bg-[#0a0a0a] px-3 py-1 rounded text-[#ccff00]">
                GET /api/pricing
              </code>
              <p className="text-gray-400 mt-1">
                Public endpoint for Sito Agoralia and App Agoralia. Returns pricing for the detected/requested currency.
              </p>
            </div>
            <div>
              <code className="bg-[#0a0a0a] px-3 py-1 rounded text-[#ccff00]">
                GET /api/pricing?country=IT
              </code>
              <p className="text-gray-400 mt-1">
                Returns pricing in EUR for Italy.
              </p>
            </div>
            <div>
              <code className="bg-[#0a0a0a] px-3 py-1 rounded text-[#ccff00]">
                GET /api/pricing?currency=USD
              </code>
              <p className="text-gray-400 mt-1">
                Force USD pricing regardless of country.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
