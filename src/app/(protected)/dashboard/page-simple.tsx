'use client'
import Link from 'next/link'
import React from 'react'

export const dynamic = 'force-dynamic';

const DashboardPage = () => {
    return (
        <div className="space-y-6">
            {/* Welcome Section */}
            <div className="bg-white p-6 rounded-lg shadow">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Dionysus</h1>
                <p className="text-gray-600">Your AI-powered GitHub development tool</p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Create Project Card */}
                <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
                    <div className="flex items-center mb-4">
                        <div className="bg-blue-100 p-2 rounded-lg mr-3">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">Create Project</h3>
                    </div>
                    <p className="text-gray-600 mb-4">Connect a GitHub repository to start analyzing your code</p>
                    <Link 
                        href="/create"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                        Get Started
                        <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                    </Link>
                </div>

                {/* Q&A Card */}
                <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
                    <div className="flex items-center mb-4">
                        <div className="bg-green-100 p-2 rounded-lg mr-3">
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">Ask Questions</h3>
                    </div>
                    <p className="text-gray-600 mb-4">Get AI-powered answers about your codebase</p>
                    <Link 
                        href="/qa"
                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50"
                    >
                        View Q&A
                    </Link>
                </div>

                {/* Meetings Card */}
                <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
                    <div className="flex items-center mb-4">
                        <div className="bg-purple-100 p-2 rounded-lg mr-3">
                            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">Meetings</h3>
                    </div>
                    <p className="text-gray-600 mb-4">Record and analyze your team meetings</p>
                    <Link 
                        href="/meetings"
                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50"
                    >
                        View Meetings
                    </Link>
                </div>
            </div>

            {/* Recent Projects */}
            <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Projects</h2>
                <div className="text-gray-500 text-center py-8">
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <p className="text-lg font-medium">No projects yet</p>
                    <p className="text-sm">Create your first project to get started</p>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow text-center">
                    <div className="text-2xl font-bold text-blue-600">0</div>
                    <div className="text-sm text-gray-600">Projects</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow text-center">
                    <div className="text-2xl font-bold text-green-600">0</div>
                    <div className="text-sm text-gray-600">Questions Asked</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow text-center">
                    <div className="text-2xl font-bold text-purple-600">0</div>
                    <div className="text-sm text-gray-600">Meetings Recorded</div>
                </div>
            </div>
        </div>
    )
}

export default DashboardPage
