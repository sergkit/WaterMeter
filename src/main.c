
#include <stdio.h>

//#include "mgos_rpc.h"

#include "common/cs_dbg.h"
#include "common/json_utils.h"
#include "common/platform.h"
#include "frozen.h"
#include "mgos_app.h"
#include "mgos_gpio.h"
#include "mgos_net.h"
#include "mgos_sys_config.h"
#include "mgos_timers.h"
#include "mgos_gcp.h"
#include "mgos_pwm.h"
#include "mgos_rpc_service_ota.h"

volatile uint32_t i[5];
volatile int lastFilter, curFilter;
volatile bool changed = false, floatOn = false;
bool connected = false, bottleFull = false, pick = false;
int startPin, countPin, pickPin, pickFreq, pickToggle, filterPin, filterDivider, filterSize, connectPin;
mgos_timer_id timerId;

static void button_cb(int pin, void *arg)
{
  //LOG(LL_INFO, ("Click!"));
  int p;
  p = pin - startPin;
  i[p]++;

  if (pin == filterPin)
  {
    floatOn = true;
    curFilter++;
    if ((i[p] % filterDivider) == 0)
    {
      changed = true;
    }
  }
  else
  {
    changed = true;
  }

  // LOG(LL_INFO, ("%d", i[p]));
  (void)pin;
  (void)arg;
}

static void pick_timer(void *arg)
{
  //LOG(LL_INFO, ("pickTimer"));
  pick = !pick;
  float on;
  if (pick)
  {
    on = 0.5;
  }
  else
  {
    on = 0;
  }
  if (!bottleFull)
  {
    on = 0;
  }
  mgos_pwm_set(pickPin, pickFreq, on);
  (void)arg;
}

static void processBottle()
{
  bool bottleChange = false;
  if (curFilter != lastFilter)
  {
    //вода течет
    lastFilter = curFilter;
    if (curFilter > filterSize & !bottleFull)
    {
      bottleFull = true;
      bottleChange = true;
    }
  }
  else
  {
    if (floatOn)
    {
      floatOn = false;
      curFilter = lastFilter = 0;
      bottleFull = false;
      bottleChange = true;
    }
  }
  if (bottleChange)
  {
    if (bottleFull)
    {
      timerId = mgos_set_timer(pickToggle, MGOS_TIMER_REPEAT, pick_timer, NULL);
    }
    else
    {
      mgos_set_timer(pickToggle, MGOS_TIMER_RUN_NOW, pick_timer, NULL);
      mgos_clear_timer(timerId);
    }
  }
}
static void my_timer_cb(void *arg)
{
  //LOG(LL_INFO, ("cbTimer"));
  processBottle();
  if (changed)
  {
    LOG(LL_INFO, ("state: %d - %d - %d", i[0], i[1], i[2]));
    changed = false;

    if (connected && mgos_gcp_is_connected())
    {
      if (mgos_gcp_send_eventf("{a:%d,b:%d,c:%d,d:%d,f:%d}", i[0], i[1], i[2], i[3], i[4]))
      {
        LOG(LL_INFO, ("GCP send"));
      }
    }
  }
  (void)arg;
}

static void my_timer_state(void *arg)
{
  LOG(LL_INFO, ("{a:%d,b:%d,c:%d,d:%d,f:%d,mem:%d,uptime:%d}",
                i[0], i[1], i[2], i[3], i[4], (int)mgos_get_free_heap_size(), (int)mgos_uptime()));
  if (connected && mgos_gcp_is_connected())
  {
    if (mgos_gcp_send_event_subf("state", "{a:%d,b:%d,c:%d,d:%d,f:%d,mem:%d,uptime:%d}",
                                 i[0], i[1], i[2], i[3], i[4], mgos_get_free_heap_size(), mgos_uptime()))
    {
      LOG(LL_INFO, ("GCP send"));
    }
    mgos_gpio_setup_output(connectPin, false);
  }
  else
  {
    mgos_gpio_setup_output(connectPin, true);
  }

  (void)arg;
}

static void my_net_ev_handler(int ev, void *evd, void *arg)
{
  if (ev == MGOS_NET_EV_IP_ACQUIRED)
  {
    LOG(LL_INFO, ("Connected+++++!"));
    connected = true;
    mgos_gpio_setup_output(connectPin, false);
  }
  else
  {
    LOG(LL_INFO, ("Connected------!"));
    connected = false;
    mgos_gpio_setup_output(connectPin, true);
  }
  (void)evd;
  (void)arg;
}
//
enum mgos_app_init_result mgos_app_init(void)
{
  enum mgos_gpio_pull_type btn_pull;
  enum mgos_gpio_int_mode btn_int_edge;
  btn_pull = MGOS_GPIO_PULL_NONE;
  btn_int_edge = MGOS_GPIO_INT_EDGE_NEG;
  startPin = mgos_sys_config_get_app_startPin();
  countPin = mgos_sys_config_get_app_countPin();
  filterDivider = mgos_sys_config_get_app_filterDivider();
  filterPin = mgos_sys_config_get_app_filterPin();
  filterSize = mgos_sys_config_get_app_filterSize();

  pickPin = mgos_sys_config_get_app_pickPin();
  pickFreq = mgos_sys_config_get_app_pickFreq();
  pickToggle = mgos_sys_config_get_app_pickToggle();
  mgos_gpio_set_mode(pickPin, MGOS_GPIO_MODE_OUTPUT);

  connectPin = mgos_sys_config_get_app_connectPin();
  mgos_gpio_set_mode(connectPin, MGOS_GPIO_MODE_OUTPUT);
  mgos_gpio_setup_output(connectPin, true);

  // Инициализация входов
  int i;
  for (i = startPin; i < countPin + startPin; i++)
  {
    mgos_gpio_set_button_handler(i, btn_pull, btn_int_edge, 20, button_cb, NULL);
  }
  //таймер проверки изменений входов
  mgos_set_timer(mgos_sys_config_get_app_updateTimer(), MGOS_TIMER_REPEAT, my_timer_cb, NULL);
  //Таймер отправки состояния
  mgos_set_timer(mgos_sys_config_get_app_statusTimer(), MGOS_TIMER_REPEAT, my_timer_state, NULL);
  //Отслеживание событий сети
  mgos_event_add_group_handler(MGOS_EVENT_GRP_NET, my_net_ev_handler, NULL);

  return MGOS_APP_INIT_SUCCESS;
}
