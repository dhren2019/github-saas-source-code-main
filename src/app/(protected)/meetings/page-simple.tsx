'use client'
import React from 'react'

export const dynamic = 'force-dynamic';

const MeetingsPage = () => {
    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Meetings</h1>
                <p className="text-gray-600">Record and analyze your team meetings</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-center py-12">
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No meetings yet</h3>
                    <p className="text-gray-500 mb-4">Start recording meetings to get AI-powered insights</p>
                    <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                        Start Recording
                    </button>
                </div>
            </div>
        </div>
    )
}

export default MeetingsPage
