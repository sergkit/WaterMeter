const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { OAuth2Client } = require('google-auth-library');

admin.initializeApp();
const db = admin.database();

// константы  для программы
const FUNCTIONS_REDIRECT = `https://us-central1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/oauthcallback`;
const CONFIG_CLIENT_ID = functions.config().googleapi.client_id;
const CONFIG_CLIENT_SECRET = functions.config().googleapi.client_secret;
// путь для сохранения токена
const DB_TOKEN_PATH = '/api_tokens';

/* для инициализации пременных окружения выполнить из командной строки
firebase functions:config:set googleapi.client_id="CLIENT_ID" googleapi.client_secret="SECRET" googleapi.mailto="MAILTO" googleapi.email="MAILFROM"
а потом 
firebase deploy --only functions
cd  d:\progs\rpc-c\firebase\functions
*/

// перечень используемых API, если изменить, нужно заново вызать функцию авторизации
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose', 'https://www.googleapis.com/auth/gmail.send'];

const functionsOauthClient = new OAuth2Client(CONFIG_CLIENT_ID, CONFIG_CLIENT_SECRET,
  FUNCTIONS_REDIRECT);

//вызов функции авторизации
exports.authgoogleapi = functions.https.onRequest((req, res) => {
  res.set('Cache-Control', 'private, max-age=0, s-maxage=0');
  res.redirect(functionsOauthClient.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  }));
});

// очистка статистики
exports.removestat = functions.https.onRequest(async (req, res) => {
  await db.ref("devices-telemetry/WMETER_11A214/stat").remove();
  await db.ref(`reg`).remove();
  return res.status(200).send('Stat % reg folders clear ');
});


// коллбэк функция авторизации, получает и сохраняет токен
exports.oauthcallback = functions.https.onRequest(async (req, res) => {
  console.log(`oauthcallback_start`);
  res.set('Cache-Control', 'private, max-age=0, s-maxage=0');
  const code = req.query.code;
  console.log(`oauthcallback: ${code}`);
  try {
    const { tokens } = await functionsOauthClient.getToken(code);
    console.log(`oauthcallback_token: ${tokens}`);
    // сохраненеи токена авторизации
    await db.ref(DB_TOKEN_PATH).set(tokens);
    return res.status(200).send('App successfully configured with new Credentials. '
      + 'You can now close this page.');
  } catch (error) {
    return res.status(400).send(error);
  }
});

let oauthTokens = null;
// проверка и подготовка данных авторизации
async function getAuthorizedClient() {
  if (oauthTokens) {
    return functionsOauthClient;
  }
  const snapshot = await db.ref(DB_TOKEN_PATH).once('value');
  oauthTokens = snapshot.val();
  functionsOauthClient.setCredentials(oauthTokens);
  return functionsOauthClient;
}

let dataNew = {}, data = {}, val = {}, ref = {}, config = {};
let deviceId = "", s, t, str, saveData = false;
//чтение предыдущих показаний контроллера
function getLast() {
  return ref.child("last").once('value')
    .then((snapshot) => {
      console.log("last", snapshot.toJSON());
      ss = 0;
      if (snapshot.toJSON().t < data.t) {
        const maxInc = { a: 3, b: 3, c: 500, d: 0, f: 0 };// максимальный прирос показаний, на случай если порядок сообщений будет нарушен
        snapshot.forEach((child) => {
          const v = child.val();
          if (child.key != "t") {
            var v1 = v * 1;
            if (data[child.key] == v1) {

              data[child.key] = 0;
            } else if (data[child.key] > v1) {
              data[child.key] = data[child.key] - v1;
            } else if (data[child.key] < v1 && data[child.key] < maxIncх[child.key]) {
              data[child.key] = 0;
            }
            ss += data[child.key];
          }
        });
      } else {
        console.log("message sequence error ");
      }
      console.log("lastreal", data);
      saveData = (ss > 0);
      //      console.log("ss", saveData, ss);
    });
}
// чтение конфига
function getConfig() {
  return ref.child("config").once('value')
    .then((snapshotConf) => {
      config = snapshotConf.toJSON();
      //console.log("config", config);
    });
}
//чтение счетчиков
function getCounters() {
  return ref.child("val").once('value')
    .then((v) => {
      val = v;;
    })
}

//сохранение показаний контроллера
function saveLast() {
  return ref.child("last").set(dataNew);
}
//сохранение статистики
function saveStat() {
  var stat = typeof config.stat === "undefined" ? 1 : config.stat;
  if (stat == 1 && saveData) {
    return db.ref(`devices-telemetry/${deviceId}/stat/${str}`).set({ "d": dataNew, "s": data });
  } else {
    return true;
  }
}
//сохранение статистики
function saveReg(s) {
  var stat = typeof config.stat === "undefined" ? 1 : config.stat;
  if (stat == 1) {
    return ref.child("val").once('value')
      .then((snapshot) => {
        const ss = snapshot.toJSON();
        console.log("savereg", ss);
        s.f = ss.c;
        return db.ref(`reg`).push(s);
      });
  } else {
    return true;
  }
}
// вычисление  и сохранение счетчиков
function saveCounters() {
  if (saveData) {
    val.forEach((child) => {
      const v = child.val();
      if (child.key != "t") {
        data[child.key] = v + data[child.key] * config[child.key];
      }
    });
    console.log("data", data);
    return ref.child("val").set(data);
  } else {
    return true;
  }
}
// обработка событий registry
exports.detectRegEvents = functions.pubsub.topic('registry-topic')
  .onPublish((message, context) => {
    const m = message.json.mem.toFixed();
    const u = message.json.uptime.toFixed();
    const a = message.json.a.toFixed();
    const b = message.json.b.toFixed();
    const c = message.json.c.toFixed();
    const t = context.timestamp
    const s = { t: t, m: m, u: u, a: a, b: b, c: c, };
    deviceId = message.attributes.deviceId;
    ref = db.ref(`devices-telemetry/${deviceId}`);
    return Promise.all([
      getConfig()
    ])
      .then(() => {
        return saveReg(s);
      })
  });

// обработка получения данных от контроллера
exports.detectTelemetryEvents = functions.pubsub.topic('main-telemetry-topic')
  .onPublish((message, context) => {
    const a = message.json.a.toFixed();
    const b = message.json.b.toFixed();
    const c = message.json.c.toFixed();
    const d = message.json.d.toFixed();
    const f = message.json.f.toFixed();
    deviceId = message.attributes.deviceId;
    const timestamp = context.timestamp;

    data = {
      t: timestamp,
      a: a,
      b: b,
      c: c,
      d: d,
      f: f
    };
    dataNew = {
      t: timestamp,
      a: a,
      b: b,
      c: c,
      d: d,
      f: f
    };
    s = a + b
    t = timestamp.split(".").join("-");
    str = `${t}-${a}-${b}`;
    ref = db.ref(`devices-telemetry/${deviceId}`);

    return Promise.all([
      getLast(),
      getConfig(),
      getCounters()
    ])
      .then(() => {
        return saveCounters();
      })
      .then(() => {
        return Promise.all([
          saveLast(),
          saveStat(),
          checkEmail()
        ])
      });
  });

// проверка необходимости отправки письма
function checkEmail() {
  var dt = new Date();
  var month = dt.getMonth();
  var day = dt.getDate();
  config['m'] = (typeof config['m'] == "undefined") ? month : config['m']; //создать параметр
  if (day >= config['day'] && month == config['m']) {
    month++;
    if (month == 12) {
      month = 0;
    }
    console.log(`emailStart`);
    var year = dt.getFullYear();
    db.ref(`devices-telemetry/${deviceId}/config/m`).set(month);
    db.ref(`devices-telemetry/${deviceId}/config/y`).set(year);
    //сохранение данных за предыдущий месяц
    db.ref(`devices-telemetry/${deviceId}/res/${year}-${dt.getMonth()}`).set(data);
    return sendemail(data.a.toFixed(2), data.b.toFixed(2), data.c.toFixed(2), data.t);
  }
  return true;
}
//отправка письма
function sendemail(a, b, f, dt) {
  return getAuthorizedClient()
    .then((auth) => {
      try {
        var Mail = require('./createMail.js');
        var mess = `<h1>Привет</h1><p>Показания счетчиков на сегодня<br>Хол. вода: ${a} <br>Гор. вода: ${b} <br>Фильтр: ${f} <br></p><p>Ваши счетчики</p>`;
        var obj = new Mail(auth, functions.config().googleapi.mailto, `Показания счетчиков ${dt}`, mess, 'mail');
        // отправка письма
        obj.makeBody();
        console.log(`emailSend`);
        return true;
      } catch (error) {
        console.log(`emailprocessError`, error);
        return false;
      }
    });
}