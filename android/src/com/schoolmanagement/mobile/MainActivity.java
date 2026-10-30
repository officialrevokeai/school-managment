package com.schoolmanagement.mobile;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.JsResult;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebStorage;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;

public final class MainActivity extends Activity {
    private LinearLayout root;
    private FrameLayout page;
    private WebView web;
    private ProgressBar progress;
    private TextView serverLabel;
    private String origin = "";
    private ValueCallback<Uri[]> fileResult;
    private Download pendingDownload;
    private volatile boolean downloadBusy;
    private static final int PICK_FILE = 20, SAVE_DOWNLOAD = 21;
    private static final long MAX_DOWNLOAD = 25L * 1024 * 1024;
    private static final class Download {
        final String url, cookie, userAgent, mime, name;
        Download(String u, String c, String a, String m, String n) { url=u;cookie=c;userAgent=a;mime=m;name=n; }
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.rgb(242,243,247));
        root.setOnApplyWindowInsetsListener((view,insets)->{
            if(Build.VERSION.SDK_INT>=30){android.graphics.Insets safe=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.ime());view.setPadding(safe.left,safe.top,safe.right,safe.bottom);}
            else view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            return insets;
        });
        if(Build.VERSION.SDK_INT>=29)root.setForceDarkAllowed(false);
        setContentView(root);root.requestApplyInsets();
        if(Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,this::back);
        String saved=preferences().getString("server","");
        try { origin=ServerPolicy.normalize(saved);openSchool(); } catch(IllegalArgumentException e){showSetup();}
    }
    private SharedPreferences preferences(){return getSharedPreferences("school_connection",MODE_PRIVATE);}
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    private TextView text(String value,int size){TextView v=new TextView(this);v.setText(value);v.setTextSize(size);v.setTextColor(Color.rgb(38,40,51));v.setPadding(0,dp(7),0,dp(7));return v;}
    private Button button(String value,Runnable action){Button b=new Button(this);b.setText(value);b.setAllCaps(false);b.setMinHeight(dp(48));b.setOnClickListener(v->action.run());return b;}
    private void destroyWeb(){if(fileResult!=null){fileResult.onReceiveValue(null);fileResult=null;}if(web!=null){web.stopLoading();if(web.getParent() instanceof android.view.ViewGroup)((android.view.ViewGroup)web.getParent()).removeView(web);web.destroy();web=null;}}
    private void showSetup(){
        destroyWeb();root.removeAllViews();
        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);root.addView(scroll,new LinearLayout.LayoutParams(-1,-1));
        LinearLayout outer=new LinearLayout(this);outer.setOrientation(1);outer.setGravity(Gravity.CENTER);outer.setPadding(dp(20),dp(24),dp(20),dp(24));
        outer.setBackground(new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{0xFFEEEAF9,0xFFF0F5FA,0xFFE8F3EE}));scroll.addView(outer);
        LinearLayout card=new LinearLayout(this);card.setOrientation(1);card.setPadding(dp(24),dp(24),dp(24),dp(24));GradientDrawable bg=new GradientDrawable();bg.setColor(0xFFF9FAFF);bg.setCornerRadius(dp(20));card.setBackground(bg);
        LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(Math.min(getResources().getDisplayMetrics().widthPixels-dp(40),dp(480)),-2);outer.addView(card,cp);
        card.addView(text("School Management",26));card.addView(text("Connect to your school",19));
        card.addView(text("Enter the official HTTPS server address provided by your school. You will then sign in with your school account.",15));
        card.addView(text("School server address",14));
        EditText address=new EditText(this);address.setSingleLine(true);address.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_URI);address.setHint("https://school.example.com");address.setText(origin);address.setContentDescription("School server address");card.addView(address,new LinearLayout.LayoutParams(-1,dp(56)));
        TextView error=text("",14);error.setTextColor(0xFFA32636);error.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);card.addView(error);
        card.addView(button("Connect securely",()->{try{String selected=ServerPolicy.normalize(address.getText().toString());origin=selected;preferences().edit().putString("server",selected).apply();openSchool();}catch(IllegalArgumentException e){error.setText(e.getMessage());}}));
        card.addView(text("This APK does not include a school server or school data. The server must be online. A localhost address on your computer cannot connect other phones.",13));
        card.addView(button("Share this APK",this::shareApk));
    }
    @SuppressWarnings("SetJavaScriptEnabled") private void openSchool(){
        destroyWeb();root.removeAllViews();
        LinearLayout bar=new LinearLayout(this);bar.setGravity(Gravity.CENTER_VERTICAL);bar.setPadding(dp(8),0,dp(8),0);root.addView(bar,new LinearLayout.LayoutParams(-1,dp(54)));
        Button backButton=button("‹",this::back);backButton.setContentDescription("Back");bar.addView(backButton,new LinearLayout.LayoutParams(dp(48),dp(48)));
        serverLabel=text(Uri.parse(origin).getHost(),13);serverLabel.setMaxLines(2);bar.addView(serverLabel,new LinearLayout.LayoutParams(0,-2,1));
        Button menu=button("⋮",()->showMenu(bar));menu.setContentDescription("App menu");bar.addView(menu,new LinearLayout.LayoutParams(dp(48),dp(48)));
        progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);progress.setMax(100);root.addView(progress,new LinearLayout.LayoutParams(-1,dp(3)));
        page=new FrameLayout(this);root.addView(page,new LinearLayout.LayoutParams(-1,0,1));web=new WebView(this);web.setSaveEnabled(false);page.addView(web,new FrameLayout.LayoutParams(-1,-1));
        WebView.setWebContentsDebuggingEnabled(false);
        WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setAllowFileAccessFromFileURLs(false);s.setAllowUniversalAccessFromFileURLs(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setSafeBrowsingEnabled(true);s.setCacheMode(WebSettings.LOAD_NO_CACHE);s.setJavaScriptCanOpenWindowsAutomatically(false);s.setSupportMultipleWindows(false);s.setMediaPlaybackRequiresUserGesture(true);s.setUseWideViewPort(true);s.setTextZoom(100);s.setUserAgentString(s.getUserAgentString()+" SchoolManagementAndroid/1.0");
        CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){
                if(!r.isForMainFrame())return false;
                String target=r.getUrl().toString();if(ServerPolicy.sameOrigin(origin,target))return false;
                if(r.hasGesture()&&"https".equalsIgnoreCase(r.getUrl().getScheme()))new AlertDialog.Builder(MainActivity.this).setTitle("Open external website?").setMessage(r.getUrl().getHost()).setNegativeButton("Cancel",null).setPositiveButton("Open browser",(d,w)->external(target)).show();
                return true;
            }
            @Override public void onPageFinished(WebView v,String url){CookieManager.getInstance().flush();}
            @Override public void onReceivedSslError(WebView v,SslErrorHandler handler,SslError error){handler.cancel();connectionError("The school server's security certificate could not be verified. Contact your administrator.");}
            @Override public void onReceivedError(WebView v,WebResourceRequest r,WebResourceError error){if(r.isForMainFrame())connectionError("Could not connect to your school. Check your internet connection and server address.");}
            @Override public void onReceivedHttpError(WebView v,WebResourceRequest r,WebResourceResponse response){if(r.isForMainFrame()&&response.getStatusCode()>=400)connectionError("The school server returned an error ("+response.getStatusCode()+"). Contact your administrator or retry.");}
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public void onProgressChanged(WebView v,int value){progress.setProgress(value);progress.setVisibility(value==100?View.GONE:View.VISIBLE);}
            @Override public boolean onJsAlert(WebView v,String url,String message,JsResult result){new AlertDialog.Builder(MainActivity.this).setTitle("School Management").setMessage(message).setPositiveButton("OK",(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show();return true;}
            @Override public boolean onJsConfirm(WebView v,String url,String message,JsResult result){new AlertDialog.Builder(MainActivity.this).setTitle("School Management").setMessage(message).setNegativeButton("Cancel",(d,w)->result.cancel()).setPositiveButton("Confirm",(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show();return true;}
            @Override public boolean onJsBeforeUnload(WebView v,String url,String message,JsResult result){new AlertDialog.Builder(MainActivity.this).setTitle("Leave this page?").setMessage("You may have unsaved changes.").setNegativeButton("Stay",(d,w)->result.cancel()).setPositiveButton("Leave",(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show();return true;}
            @Override public void onPermissionRequest(PermissionRequest request){request.deny();}
            @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> result,FileChooserParams params){
                if(fileResult!=null)fileResult.onReceiveValue(null);fileResult=result;
                try{Intent intent=params.createIntent();intent.addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(intent,PICK_FILE);}catch(Exception e){fileResult.onReceiveValue(null);fileResult=null;toast("No file picker is available.");}return true;
            }
        });
        web.setDownloadListener((url,agent,disposition,mime,size)->prepareDownload(url,agent,disposition,mime));
        web.loadUrl(origin+"/#/signin");
    }
    private void showMenu(View anchor){PopupMenu popup=new PopupMenu(this,anchor);popup.getMenu().add("Reload school");popup.getMenu().add("Open in browser");popup.getMenu().add("Change school server");popup.getMenu().add("Share this APK");popup.setOnMenuItemClickListener(item->{String title=item.getTitle().toString();if(title.equals("Reload school"))retry();else if(title.equals("Open in browser"))external(origin+"/#/signin");else if(title.equals("Change school server"))changeServer();else shareApk();return true;});popup.show();}
    private void external(String url){try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(Exception e){toast("No browser is available.");}}
    private void retry(){if(web==null)return;page.removeAllViews();page.addView(web,new FrameLayout.LayoutParams(-1,-1));web.setVisibility(View.VISIBLE);web.loadUrl(origin+"/#/signin");}
    private void connectionError(String message){if(web==null)return;web.setVisibility(View.GONE);progress.setVisibility(View.GONE);LinearLayout box=new LinearLayout(this);box.setOrientation(1);box.setGravity(Gravity.CENTER);box.setPadding(dp(24),dp(24),dp(24),dp(24));box.setBackgroundColor(0xFFF2F3F7);box.addView(text("School unavailable",23));box.addView(text(message,16));box.addView(button("Retry",this::retry));box.addView(button("Change school server",this::changeServer));page.addView(box,new FrameLayout.LayoutParams(-1,-1));}
    private void changeServer(){new AlertDialog.Builder(this).setTitle("Change school server?").setMessage("This clears the saved web session on this device. School records and other devices are not deleted.").setNegativeButton("Cancel",null).setPositiveButton("Continue",(d,w)->CookieManager.getInstance().removeAllCookies(done->{WebStorage.getInstance().deleteAllData();if(web!=null){web.clearCache(true);web.clearHistory();}preferences().edit().remove("server").apply();origin="";showSetup();})).show();}
    private void shareApk(){Uri uri=Uri.parse("content://com.schoolmanagement.mobile.apk/app.apk");Intent share=new Intent(Intent.ACTION_SEND);share.setType("application/vnd.android.package-archive");share.putExtra(Intent.EXTRA_STREAM,uri);share.setClipData(ClipData.newRawUri("School Management APK",uri));share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);try{startActivity(Intent.createChooser(share,"Share School Management APK"));}catch(Exception e){toast("No app is available to share the APK.");}}
    private void prepareDownload(String url,String agent,String disposition,String mime){
        if(!ServerPolicy.sameOrigin(origin,url)){toast("This download is not from your configured school. Use the browser for external downloads.");return;}
        if(downloadBusy||pendingDownload!=null){toast("Finish the current download first.");return;}
        String safeMime=mime!=null&&mime.matches("[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+")?mime:"application/octet-stream";
        String name=ServerPolicy.filename(URLUtil.guessFileName(url,disposition,safeMime),"school-export");pendingDownload=new Download(url,CookieManager.getInstance().getCookie(url),agent,safeMime,name);
        Intent save=new Intent(Intent.ACTION_CREATE_DOCUMENT);save.addCategory(Intent.CATEGORY_OPENABLE);save.setType(safeMime);save.putExtra(Intent.EXTRA_TITLE,name);
        try{startActivityForResult(save,SAVE_DOWNLOAD);}catch(Exception e){pendingDownload=null;toast("No document picker is available.");}
    }
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);
        if(request==PICK_FILE&&fileResult!=null){Uri[] selected=WebChromeClient.FileChooserParams.parseResult(result,data);boolean valid=selected!=null&&selected.length<=10;if(valid)for(Uri uri:selected)if(!"content".equals(uri.getScheme()))valid=false;fileResult.onReceiveValue(valid?selected:null);fileResult=null;}
        if(request==SAVE_DOWNLOAD){Download download=pendingDownload;pendingDownload=null;if(result==RESULT_OK&&data!=null&&data.getData()!=null&&download!=null&&"content".equals(data.getData().getScheme()))saveDownload(download,data.getData());}
    }
    private void saveDownload(Download item,Uri destination){downloadBusy=true;toast("Downloading school file…");new Thread(()->{
        HttpsURLConnection connection=null;
        try{connection=(HttpsURLConnection)new URL(item.url).openConnection();connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(15000);connection.setReadTimeout(30000);if(item.cookie!=null)connection.setRequestProperty("Cookie",item.cookie);if(item.userAgent!=null)connection.setRequestProperty("User-Agent",item.userAgent);
            int status=connection.getResponseCode();if(status!=200)throw new java.io.IOException("HTTP "+status);if(connection.getContentLengthLong()>MAX_DOWNLOAD)throw new java.io.IOException("File exceeds 25 MB");
            try(InputStream input=connection.getInputStream();OutputStream output=getContentResolver().openOutputStream(destination,"w")){if(output==null)throw new java.io.IOException("Cannot open file");byte[] buffer=new byte[16384];long total=0;int n;while((n=input.read(buffer))!=-1){total+=n;if(total>MAX_DOWNLOAD)throw new java.io.IOException("File exceeds 25 MB");output.write(buffer,0,n);}output.flush();}
            runOnUiThread(()->toast("School file saved."));
        }catch(Exception e){runOnUiThread(()->{if(!isFinishing()&&!isDestroyed())new AlertDialog.Builder(this).setTitle("Download failed").setMessage("No completed download was confirmed. Check your connection and sign-in. The selected file may be incomplete; remove it before retrying.").setPositiveButton("OK",null).show();});}
        finally{if(connection!=null)connection.disconnect();downloadBusy=false;}
    },"SchoolDownload").start();}
    private void toast(String value){Toast.makeText(this,value,Toast.LENGTH_LONG).show();}
    private void back(){if(web!=null&&web.canGoBack())web.goBack();else finish();}
    @Override public void onBackPressed(){back();}
    @Override protected void onPause(){if(web!=null)web.onPause();CookieManager.getInstance().flush();super.onPause();}
    @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
    @Override protected void onDestroy(){destroyWeb();super.onDestroy();}
}
