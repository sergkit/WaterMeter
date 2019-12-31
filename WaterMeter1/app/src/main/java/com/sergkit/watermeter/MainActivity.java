package com.sergkit.watermeter;

import androidx.appcompat.app.AppCompatActivity;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import androidx.preference.PreferenceManager;
import android.util.Log;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MenuItem;
import android.view.View;
import android.view.View.OnClickListener;
import android.widget.Button;
import android.widget.TextView;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;

import java.util.Locale;

public class MainActivity extends AppCompatActivity implements OnClickListener{
    private static final String LOG_TAG = "WMLogs";
    private Locale LocaleRu = new Locale("ru","RU");

    private DatabaseReference myD;
    private FirebaseAuth mAuth;
    private SharedPreferences sPref;

    private TextView hwo_textView;
    private TextView hwn_textView;
    private TextView cwo_textView;
    private TextView cwn_textView;
    private TextView fo_textView;
    private TextView fn_textView;
    private TextView cw_calc_textView;
    private TextView hw_calc_textView;
    private TextView all_calc_textView;

    private Double hwt;
    private Double cwt;
    private Double otv;
    // данные для расчета  текущего потребления
    private Double hwStart;
    private Double cwStart;
    private Double cwCurrent;
    private Double hwCurrent;
    private boolean calcStart;

    private String devId;


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        mAuth = FirebaseAuth.getInstance();

        hwo_textView  = (TextView) findViewById(R.id.tv_hw_o);
        hwn_textView  = (TextView) findViewById(R.id.tv_hw_n);
        cwo_textView  = (TextView) findViewById(R.id.tv_cw_o);
        cwn_textView  = (TextView) findViewById(R.id.tv_cw_n);
        fo_textView  = (TextView) findViewById(R.id.tv_f_o);
        fn_textView  = (TextView) findViewById(R.id.tv_f_n);
        cw_calc_textView  = (TextView) findViewById(R.id.tv_cw_calc);
        hw_calc_textView  = (TextView) findViewById(R.id.tv_hw_calc);
        all_calc_textView  = (TextView) findViewById(R.id.tv_calc_all);

        Button btnCalc = (Button)findViewById(R.id.btnCalc);
        btnCalc.requestFocus();
        btnCalc.setOnClickListener(this);

        calcStart=false;
        devId="";
        loadTariff();
        addDatabaseListener();

    }

    private void addDatabaseListener(){
        try {
        FirebaseDatabase database = FirebaseDatabase.getInstance();
        myD = database.getReference("devices-telemetry/"+devId);
        myD.addValueEventListener(new ValueEventListener() {
            @Override
            public void onDataChange(DataSnapshot dataSnapshot) {
                // This method is called once with the initial value and again
                // whenever data at this location is updated.
                try {
                    DataSnapshot dsRes;
                    dsRes = dataSnapshot.child("val");
                    Double a = (Double) dsRes.child("a").getValue();
                    Double b = (Double) dsRes.child("b").getValue();
                    Double c = (Double) dsRes.child("c").getValue();
                    hwCurrent = b;
                    cwCurrent = a;
                    fn_textView.setText(String.format(LocaleRu, "%.3f л", c));
                    cwn_textView.setText(String.format(LocaleRu, "%.3f м3", a));
                    hwn_textView.setText(String.format(LocaleRu, "%.3f м3", b));
                    // получить из config  дату последнего отправленного результата
                    dsRes = dataSnapshot.child("config");
                    int m = ((Long) dsRes.child("m").getValue()).intValue();
                    int y = ((Long) dsRes.child("y").getValue()).intValue();
                    m--;
                    if (m < 0) {
                        m = 11;
                        y--;
                    }
                    String k = String.valueOf(y);
                    k += "-";
                    k += String.valueOf(m);
                    dsRes = dataSnapshot.child("res").child(k);
                    //получить данные предыдущего месяца
                    Double a1 = (Double) dsRes.child("a").getValue();
                    Double b1 = (Double) dsRes.child("b").getValue();
                    Double c1 = (Double) dsRes.child("c").getValue();
                    fo_textView.setText(String.format(LocaleRu, "%.3f л", c1));
                    cwo_textView.setText(String.format(LocaleRu, "%.3f м3", a1));
                    hwo_textView.setText(String.format(LocaleRu, "%.3f м3", b1));

                    //получить текущий расход
                    cw_calc_textView.setText(String.format(LocaleRu, "%.2f руб", (a - a1) * (cwt + otv)));
                    hw_calc_textView.setText(String.format(LocaleRu, "%.2f руб", (b - b1) * (hwt + otv)));
                    if (calcStart) {
                        all_calc_textView.setText(String.format(LocaleRu, "%.2f руб", (hwCurrent - hwStart) * (hwt + otv) + (cwCurrent - cwStart) * (cwt + otv)));
                    }
                }catch (Exception e) {
                    e.printStackTrace();
                }
            }

            @Override
            public void onCancelled(DatabaseError error) {
                Log.w(LOG_TAG, "Failed to read value.", error.toException());
            }
        });
    } catch (Exception e) {
        e.printStackTrace();
    }
}

    private void loadTariff() {
        sPref = PreferenceManager.getDefaultSharedPreferences(this);
        String s;
        devId=sPref.getString(getResources().getString(R.string.pref_device_key), "");
        s=sPref.getString("et_cw", "0.0");
        cwt=Double.valueOf(s);
        s=sPref.getString("et_hw", "0.0");
        hwt=Double.valueOf(s);
        s=sPref.getString("et_otv", "0.0");
        otv=Double.valueOf(s);
    }

    @Override
    public void onResume() {
        super.onResume();
        loadTariff();
        addDatabaseListener();
    }

    @Override
    public void onClick(View v) {
        int id;
        id=v.getId();
        switch (id){
            case R.id.btnCalc:
                calcStart=true;
                hwStart=hwCurrent;
                cwStart=cwCurrent;
                all_calc_textView.setVisibility(View.VISIBLE);
                all_calc_textView.setText(String.format(LocaleRu,"%.2f руб",0.0));
                break;
        }
    }
    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        MenuInflater menuInflater = getMenuInflater();
        menuInflater.inflate(R.menu.settings_menu, menu);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        int id = item.getItemId();
        if (id == R.id.action_settings) {
            Intent intent = new Intent(MainActivity.this, SettingsActivity.class);
            startActivity(intent);
            return true;
        }
        return super.onOptionsItemSelected(item);
    }


}
