"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

const CONFIG_API_URL = process.env.NEXT_PUBLIC_CONFIG_API_URL || "http://localhost:8000"
const ADMIN_KEY = process.env.NEXT_PUBLIC_CONFIG_API_ADMIN_KEY || ""

async function fetchPricing() {
  const res = await fetch(`${CONFIG_API_URL}/pricing`)
  if (!res.ok) throw new Error("Failed to fetch pricing")
  return res.json()
}

async function updatePricing(data: any) {
  const res = await fetch(`${CONFIG_API_URL}/pricing/update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-API-Key": ADMIN_KEY,
    },
    body: JSON.stringify({ data }),
  })
  if (!res.ok) throw new Error("Failed to update pricing")
  return res.json()
}

export default function PricingPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["pricing"],
    queryFn: fetchPricing,
  })
  
  const mutation = useMutation({
    mutationFn: updatePricing,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing"] })
      alert("Pricing updated successfully!")
    },
  })
  
  const [pricingData, setPricingData] = useState<any>(null)
  
  useEffect(() => {
    if (data) {
      setPricingData(data.plans || [])
    }
  }, [data])
  
  if (isLoading) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <div className="text-center py-12">Loading...</div>
      </main>
    )
  }
  
  const handleSave = () => {
    if (!pricingData) return
    mutation.mutate({ plans: pricingData })
  }
  
  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Pricing Configuration</h1>
        <button
          onClick={handleSave}
          disabled={mutation.isPending}
          className="rounded-lg bg-black text-white px-4 py-2 hover:bg-gray-800 disabled:opacity-50"
        >
          {mutation.isPending ? "Saving..." : "Publish New Version"}
        </button>
      </div>
      
      <div className="rounded-2xl border p-6 bg-white">
        <div className="space-y-6">
          {pricingData?.map((plan: any, index: number) => (
            <div key={plan.id || index} className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">{plan.name}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Monthly Price ($)</label>
                  <input
                    type="number"
                    value={plan.price?.monthly || 0}
                    onChange={(e) => {
                      const newData = [...pricingData]
                      newData[index].price = {
                        ...newData[index].price,
                        monthly: parseInt(e.target.value) || 0,
                      }
                      setPricingData(newData)
                    }}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Yearly Price ($)</label>
                  <input
                    type="number"
                    value={plan.price?.yearly || 0}
                    onChange={(e) => {
                      const newData = [...pricingData]
                      newData[index].price = {
                        ...newData[index].price,
                        yearly: parseInt(e.target.value) || 0,
                      }
                      setPricingData(newData)
                    }}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium mb-1">Features (one per line)</label>
                <textarea
                  value={plan.features?.join("\n") || ""}
                  onChange={(e) => {
                    const newData = [...pricingData]
                    newData[index].features = e.target.value.split("\n").filter(Boolean)
                    setPricingData(newData)
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
