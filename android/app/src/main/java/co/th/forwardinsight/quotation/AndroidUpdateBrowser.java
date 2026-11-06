package co.th.forwardinsight.quotation;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AndroidUpdateBrowser")
public class AndroidUpdateBrowser extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        String value = call.getString("url");
        if (value == null) { call.reject("Missing URL"); return; }
        Uri uri = Uri.parse(value);
        String path = uri.getPath();
        if (!"https".equals(uri.getScheme()) || !"suttipat-cmd.github.io".equals(uri.getHost()) || uri.getPort() != -1 || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null || path == null || !path.startsWith("/fi-quotation-web/android/") || path.contains("..") || !path.endsWith(".apk")) {
            call.reject("Invalid download URL"); return;
        }
        try {
            getActivity().startActivity(new Intent(Intent.ACTION_VIEW, uri));
            call.resolve();
        } catch (Exception error) { call.reject("Cannot open browser", error); }
    }
}
