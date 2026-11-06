package co.th.forwardinsight.quotation;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AndroidUpdateBrowser.class);
        super.onCreate(savedInstanceState);
    }
}
