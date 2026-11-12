package com.mengxj.monosaba.mobile;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DiaryBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
