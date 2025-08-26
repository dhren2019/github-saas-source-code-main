import React from 'react'

export const dynamic = 'force-dynamic';

const SyncUser = async () => {
    // Skip during build
    if (process.env.SKIP_ENV_VALIDATION === 'true') {
        return <div>Build mode - sync disabled</div>;
    }
    
    // Lazy imports to avoid build issues
    const { db } = await import('@/server/db');
    const { auth, clerkClient } = await import('@clerk/nextjs/server');
    const { notFound, redirect } = await import('next/navigation');
    
    const { userId } = await auth()
    if (!userId) {
        throw new Error('User not found')
    }
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    if (!user.emailAddresses[0]?.emailAddress) {
        return notFound()
    }

    await db.user.upsert({
        where: {
            emailAddress: user.emailAddresses[0]?.emailAddress ?? ""
        },
        update: {
            imageUrl: user.imageUrl,
            firstName: user.firstName,
            lastName: user.lastName
        },
        create: {
            id: userId,
            emailAddress: user.emailAddresses[0]?.emailAddress ?? "",
            imageUrl: user.imageUrl,
            firstName: user.firstName,
            lastName: user.lastName
        }
    })

    return redirect('/dashboard')
}

export default SyncUser