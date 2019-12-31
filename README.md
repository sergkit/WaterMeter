<h1>Счетчик  расхода воды  и использования проточных фильтров.</h1>
Использует ESP8266 или ESP32 под управлением Mongoose-OS, Google Iot, Firebase и приложение на Android<br>
Состав:<br><ul>
<li>firebase/public  - функции  для firebase</li>
<li>mos.yml - config  для mongoose</li></li>
<li>src и fs  - папки  для Mongoose</li>
</ul>

<h2>Инсталяция:</h2>
1. Скачать и запустить mos.exe - https://mongoose-os.com/docs/mongoose-os/quickstart/setup.md<br><br>
2. Клонировать это репозиторий<br>
3. В программе mos перейти в корневую папку проекта (команда cd)<br>
4. Подключить контроллер, собрать и загрузить прошивку (mos build, mos flash)<br>
5. Создать проект в Googlу IoT (https://console.cloud.google.com/)<br>
6. Сформировать  ключи для подключения к облаку ( скачать SDK https://cloud.google.com/sdk/install, <br> 
gcloud components install beta<br>
gcloud auth login<br>
gcloud projects create {Имя проекта}<br>
gcloud projects add-iam-policy-binding {Имя проекта} --member=serviceAccount:cloud-iot@system.gserviceaccount.com --role=roles/pubsub.publisher<br>
gcloud config set project {Имя проекта}<br>
gcloud beta pubsub topics create main-telemetry-topic <br>
gcloud beta pubsub topics create registry-topic<br>
gcloud beta pubsub subscriptions create --topic main-telemetry-topic main-telemetry-subscription<br>
gcloud iot registries create devices-registry --project={Имя проекта} \<br>
--region=europe-west1 --event-notification-config=topic=registry-topic,subfolder=registry \<br>
--event-notification-config=topic=main-telemetry-topic --no-enable-http-config<br>
Из  mos выполнить команду mos gcp-iot-setup --gcp-project {Имя проекта} --gcp-region europe-west1 --gcp-registry devices-registry<br>
7. повторно зарузить прошивку (mos build, mos flash)<br>
8. Установить firebase CLI и node js<br>
9. перейти к папке firebase/function<br>
10. выполнить firebase deploy --only functions<br>
11. Переделать приложение для Андроид в Android Studio под свое устройство( 88 строка Main Activity заменить на свой путь)<br>
12. Собрать apk и загрузить на телефон<br>
