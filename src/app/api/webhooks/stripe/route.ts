import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import Stripe from "stripe";
import axios from "axios";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2024-12-18.acacia",
}) : null;

export async function POST(req: Request) {
    if (!stripe) {
        return new NextResponse("Stripe not configured", { status: 500 });
    }
    
    const body = await req.text();
    const signature = (await headers()).get("Stripe-Signature") as string;
    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET as string
        );
    } catch (error) {
        return new NextResponse("webhook error", { status: 400 });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    console.log(event.type)

    // new purchase created
    if (event.type === "checkout.session.completed") {
        const credits = Number(session.metadata?.['credits'])
        const userId = session.client_reference_id
        if (!userId) return NextResponse.json({ message: "no user id" }, { status: 400 })
        await db.user.update({ where: { id: userId }, data: { credits: { increment: credits } } })

        await db.stripeTransaction.create({ data: { userId, credits, customerId: session.customer as string } })

        return NextResponse.json({ message: "success" }, { status: 200 });
    }



    return NextResponse.json({ message: "success" }, { status: 200 });

}