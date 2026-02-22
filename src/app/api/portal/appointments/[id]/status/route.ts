/**
 * Portal Appointment Status Update
 * Allows clients to confirm or cancel their appointments.
 */

import { NextRequest, NextResponse } from 'next/server'
import { GraphQLClient, gql } from 'graphql-request'

const HASURA_URL = process.env.NEXT_PUBLIC_HASURA_URL || 'http://localhost:8080/v1/graphql'
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET || 'hasura_dev_secret_2024'

const UPDATE_APPOINTMENT_STATUS = gql`
  mutation UpdateAppointmentStatus($id: String!, $status: String!, $updated_at: timestamptz!) {
    update_appointments_by_pk(
      pk_columns: { id: $id }
      _set: { status: $status, updated_at: $updated_at }
    ) {
      id
      status
    }
  }
`

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (!status || !['confirmed', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const client = new GraphQLClient(HASURA_URL, {
      headers: {
        'x-hasura-admin-secret': HASURA_ADMIN_SECRET,
      },
    })

    const data = await client.request(UPDATE_APPOINTMENT_STATUS, {
      id,
      status,
      updated_at: new Date().toISOString(),
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[Portal API] Failed to update appointment status:', error)
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }
}
