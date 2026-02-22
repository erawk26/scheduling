/**
 * Portal Appointments API Route
 *
 * Fetches appointments for an authenticated portal client.
 * Uses admin secret to query Hasura since portal clients use session auth.
 */

import { NextRequest, NextResponse } from 'next/server'
import { GraphQLClient, gql } from 'graphql-request'

const HASURA_URL = process.env.NEXT_PUBLIC_HASURA_URL || 'http://localhost:8080/v1/graphql'
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET || 'hasura_dev_secret_2024'

const PORTAL_APPOINTMENTS_QUERY = gql`
  query PortalAppointments($email: String!) {
    appointments(
      where: {
        client: { email: { _eq: $email } }
        deleted_at: { _is_null: true }
      }
      order_by: { start_time: desc }
    ) {
      id
      start_time
      end_time
      status
      location_type
      address
      notes
      service {
        name
        duration_minutes
      }
      pet {
        name
        species
        breed
      }
    }
  }
`

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email')
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const client = new GraphQLClient(HASURA_URL, {
      headers: {
        'x-hasura-admin-secret': HASURA_ADMIN_SECRET,
      },
    })

    const data = await client.request<{ appointments: unknown[] }>(
      PORTAL_APPOINTMENTS_QUERY,
      { email }
    )

    return NextResponse.json({ appointments: data.appointments })
  } catch (error) {
    console.error('[Portal API] Failed to fetch appointments:', error)
    return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 })
  }
}
