"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"

const CONFIG_API_URL = process.env.NEXT_PUBLIC_CONFIG_API_URL || "http://localhost:8000"
const ADMIN_KEY = process.env.NEXT_PUBLIC_CONFIG_API_ADMIN_KEY || ""

async function fetchActiveCalls() {
  const res = await fetch(`${CONFIG_API_URL}/realtime/calls`, {
    headers: {
      "X-Admin-API-Key": ADMIN_KEY,
    },
  })
  if (!res.ok) throw new Error("Failed to fetch active calls")
  return res.json()
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

export default function CallsPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["active-calls"],
    queryFn: fetchActiveCalls,
    refetchInterval: 5000, // Refresh every 5 seconds
  })
  
  useEffect(() => {
    // Set up WebSocket connection for realtime updates
    const wsUrl = CONFIG_API_URL.replace("http", "ws") + "/realtime/ws"
    const ws = new WebSocket(wsUrl)
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.type === "call_started" || message.type === "call_ended" || message.type === "call_updated") {
        refetch()
      }
    }
    
    return () => {
      ws.close()
    }
  }, [refetch])
  
  if (isLoading) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <div className="text-center py-12">Loading...</div>
      </main>
    )
  }
  
  const activeCalls = data?.active_calls || []
  
  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Active Calls</h1>
        <div className="text-sm text-gray-600">
          {activeCalls.length} active call{activeCalls.length !== 1 ? "s" : ""}
        </div>
      </div>
      
      {activeCalls.length === 0 ? (
        <div className="rounded-2xl border p-12 bg-white text-center">
          <p className="text-gray-500">No active calls at the moment</p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-white overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Workspace</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Est. Cost/Min</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {activeCalls.map((call: any) => (
                <tr key={call.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{call.user_id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{call.workspace_id || "-"}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{call.model || "-"}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{call.country_code || "-"}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {call.duration_seconds ? formatDuration(call.duration_seconds) : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {call.estimated_cost_per_min_cents ? `$${(call.estimated_cost_per_min_cents / 100).toFixed(2)}` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
