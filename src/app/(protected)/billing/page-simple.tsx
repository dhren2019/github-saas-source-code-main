'use client'
import React from 'react'

export const dynamic = 'force-dynamic';

const BillingPage = () => {
    const [creditsToBuy, setCreditsToBuy] = React.useState(100)
    
    // Simplified credits calculation
    const creditsToDollars = 50 // 50 credits per dollar
    const price = (creditsToBuy / creditsToDollars).toFixed(2)
    
    const handleBuyCredits = async () => {
        // Simplified function - in production this would integrate with Stripe
        alert(`Would purchase ${creditsToBuy} credits for $${price}`)
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-white p-6 rounded-lg shadow">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">Billing & Credits</h1>
                
                {/* Current Credits */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center">
                        <div className="text-blue-600 mr-3">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-blue-900">Current Credits</h3>
                            <p className="text-sm text-blue-700">You have credits available for AI analysis</p>
                        </div>
                    </div>
                </div>

                {/* Buy Credits */}
                <div className="border border-gray-200 rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Buy Credits</h2>
                    
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Credits to buy: {creditsToBuy}
                        </label>
                        <input
                            type="range"
                            min="50"
                            max="1000"
                            step="50"
                            value={creditsToBuy}
                            onChange={(e) => setCreditsToBuy(Number(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-sm text-gray-500 mt-1">
                            <span>50</span>
                            <span>1000</span>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-700">Credits:</span>
                            <span className="font-medium">{creditsToBuy}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-700">Price:</span>
                            <span className="font-medium">${price}</span>
                        </div>
                    </div>

                    <button
                        onClick={handleBuyCredits}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                    >
                        Buy {creditsToBuy} Credits for ${price}
                    </button>
                </div>

                {/* Transaction History */}
                <div className="mt-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Transaction History</h2>
                    <div className="text-gray-500 text-center py-8">
                        No transactions yet
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BillingPage
