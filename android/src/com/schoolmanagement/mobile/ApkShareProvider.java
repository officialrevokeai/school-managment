package com.schoolmanagement.mobile;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;

/** Read-only access to this installed APK only. It cannot expose app data. */
public final class ApkShareProvider extends ContentProvider {
    private File apk(Uri uri) throws FileNotFoundException {
        if (!"com.schoolmanagement.mobile.apk".equals(uri.getAuthority()) || !"/app.apk".equals(uri.getPath())) throw new FileNotFoundException();
        return new File(getContext().getApplicationInfo().sourceDir);
    }
    @Override public boolean onCreate() { return true; }
    @Override public String getType(Uri uri) { return "application/vnd.android.package-archive"; }
    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!"r".equals(mode)) throw new FileNotFoundException("Read only");
        return ParcelFileDescriptor.open(apk(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }
    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sort) {
        try { File file = apk(uri); String[] cols = projection == null ? new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE} : projection;
            MatrixCursor cursor = new MatrixCursor(cols, 1); Object[] row = new Object[cols.length];
            for (int i=0;i<cols.length;i++) row[i] = OpenableColumns.DISPLAY_NAME.equals(cols[i]) ? "School_Management_Android.apk" : OpenableColumns.SIZE.equals(cols[i]) ? file.length() : null;
            cursor.addRow(row); return cursor;
        } catch (FileNotFoundException e) { return null; }
    }
    @Override public Uri insert(Uri u, ContentValues v) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri u, ContentValues v, String s, String[] a) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri u, String s, String[] a) { throw new UnsupportedOperationException(); }
}
