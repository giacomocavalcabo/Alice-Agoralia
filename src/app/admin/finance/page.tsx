"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"

const CONFIG_API_URL = process.env.NEXT_PUBLIC_CONFIG_API_URL || "http://localhost:8000"
const ADMIN_KEY = process.env.NEXT_PUBLIC_CONFIG_API_ADMIN_KEY || ""

async function fetchRevenue(period: string = "month") {
  const res = await fetch(`${CONFIG_API_URL}/finance/revenue?period=${period}`, {
    headers: {
      "X-Admin-API-Key": ADMIN_KEY,
    },
  })
  if (!res.ok) throw new Error("Failed to fetch revenue")
  return res.json()
}

async function fetchExpenses(period: string = "month") {
  const res = await fetch(`${CONFIG_API_URL}/finance/expenses?period=${period}`, {
    headers: {
      "X-Admin-API-Key": ADMIN_KEY,
    },
  })
  if (!res.ok) throw new Error("Failed to fetch expenses")
  return res.json()
}

export default function FinancePage() {
  const [period, setPeriod] = useState("month")
  
  const { data: revenue, isLoading: revenueLoading } = useQuery({
    queryKey: ["revenue", period],
    queryFn: () => fetchRevenue(period),
  })
  
  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ["expenses", period],
    queryFn: () => fetchExpenses(period),
  })
  
  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  
  if (revenueLoading || expensesLoading) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <div className="text-center py-12">Loading...</div>
      </main>
    )
  }
  
  const revenueByTier = Object.entries(revenue?.breakdown_by_tier || {}).map(([tier, cents]: [string, any]) => ({
    tier,
    revenue: cents / 100,
  }))
  
  const expenseByCategory = Object.entries(expenses?.breakdown_by_category || {}).map(([category, cents]: [string, any]) => ({
    category,
    expenses: cents / 100,
  }))
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']
  
  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Finance Dashboard</h1>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="month">This Month</option>
          <option value="year">This Year</option>
          <option value="all">All Time</option>
        </select>
      </div>
      
      {/* Revenue Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="rounded-2xl border p-4 bg-white">
          <div className="text-sm text-gray-600">Total Revenue</div>
          <div className="text-2xl font-bold">{formatCurrency(revenue?.total_revenue_cents || 0)}</div>
        </div>
        <div className="rounded-2xl border p-4 bg-white">
          <div className="text-sm text-gray-600">MRR</div>
          <div className="text-2xl font-bold">{formatCurrency(revenue?.mrr_cents || 0)}</div>
        </div>
        <div className="rounded-2xl border p-4 bg-white">
          <div className="text-sm text-gray-600">ARPU</div>
          <div className="text-2xl font-bold">{formatCurrency(revenue?.arpu_cents || 0)}</div>
        </div>
        <div className="rounded-2xl border p-4 bg-white">
          <div className="text-sm text-gray-600">Transactions</div>
          <div className="text-2xl font-bold">{revenue?.total_transactions || 0}</div>
        </div>
      </div>
      
      {/* Revenue by Tier */}
      {revenueByTier.length > 0 && (
        <div className="rounded-2xl border p-6 bg-white">
          <h2 className="text-lg font-semibold mb-4">Revenue by Tier</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueByTier}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="tier" />
              <YAxis />
              <Tooltip formatter={(value: number) => formatCurrency(value * 100)} />
              <Legend />
              <Bar dataKey="revenue" fill="#0088FE" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      
      {/* Expenses */}
      <div className="rounded-2xl border p-6 bg-white">
        <h2 className="text-lg font-semibold mb-4">Total Expenses: {formatCurrency(expenses?.total_expenses_cents || 0)}</h2>
        {expenseByCategory.length > 0 && (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={expenseByCategory}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ category, expenses }) => `${category}: ${formatCurrency(expenses * 100)}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="expenses"
              >
                {expenseByCategory.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value * 100)} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </main>
  )
}
