import { NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { getUserScrapeHistory, deleteUserScrapeSession, clearUserScrapeHistory } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required to view saved scrape history.' },
        { status: 401 }
      );
    }

    const history = await getUserScrapeHistory(user.id, user.email);
    return NextResponse.json({
      success: true,
      history,
      count: history.length
    });
  } catch (error: any) {
    console.error('Fetch user history error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch user history.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const clearAll = url.searchParams.get('clearAll') === 'true';
    const recordId = url.searchParams.get('id');

    if (clearAll) {
      await clearUserScrapeHistory(user.id, user.email);
      return NextResponse.json({
        success: true,
        message: 'All user scrape history cleared successfully.'
      });
    }

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: 'Record ID is required to delete an item.' },
        { status: 400 }
      );
    }

    const deleted = await deleteUserScrapeSession(user.id, recordId, user.email);
    return NextResponse.json({
      success: true,
      deleted,
      message: deleted ? 'Scrape session removed.' : 'Record not found.'
    });
  } catch (error: any) {
    console.error('Delete history error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete history record.' },
      { status: 500 }
    );
  }
}
