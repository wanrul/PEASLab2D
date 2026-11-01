// Presentation strings only. Catalog names, execution tokens and study data stay canonical.
export const ZH = Object.fromEntries(`
Continue	继续
Run	运行
Pause	暂停
Reset	重置
Normal	普通
High	高
None	无
Not selected	未选择
Criterion	成功标准
Observed result	观察结果
Status	状态
Achieved	已达到
Partially achieved	部分达到
Not achieved	未达到
not started	未开始
in progress	进行中
done	已完成
failed	失败
Revisions	修改次数
Define the current purpose	定义当前 Purpose
Choose what matters for each current task. Your selection records your design intent; your hardware and rules determine behavior.	选择每项当前任务的重点。选择会记录你的设计意图；机器人的实际行为由硬件和规则决定。
Success criterion:	成功标准：
Task priority	任务优先事项
Thorough cleaning	彻底清洁
Speed — faster completion	速度——更快完成
Correct sorting	正确分类
Safe spill cleaning	安全清理液体
Safe response	安全响应
Reliable docking	可靠对接
Speed: elapsed duration will be recorded. No time target is set for this stage.	速度：系统会记录用时。本阶段没有时间目标。
Choose a task priority for each current task to continue.	为每项当前任务选择优先事项后继续。
Set your robot priorities	设置机器人的优先事项
Give your robot senses	为机器人配置 Sensors
Give your robot a body	为机器人配置 Actuators
Walk the apartment. Then mount the sensors your robot needs.	先在公寓中走一走，再安装机器人需要的 Sensors。
Mount the parts your robot needs for the current tasks.	安装机器人完成当前任务所需的部件。
Robot sensor silhouette	机器人 Sensors 安装示意
3D robot assembly	机器人三维装配预览
See what your robot sees	查看机器人能感知什么
3D assembly preview is unavailable. Installed modules are labeled at their mounting points below.	三维装配预览暂不可用。已安装模块的名称显示在下方安装位。
Program your robot	为机器人编程
For each task, build rules: what it senses, when, what it does.	为每项任务编写规则：感知什么、何时执行、执行什么。
Live rule preview	规则实时预览
Block library	积木库
Add rule	添加规则
Remove rule	删除规则
Execution priority	执行优先级
CONTROL (optional)	CONTROL（可选）
SENSING	感知
DECIDING	决策
ACTING	行动
Test & debug	Test & Debug
Observe the results against the current criteria. Revise your design and try again.	对照当前成功标准观察结果，修改设计后再次尝试。
End run & evaluate	结束运行并评估
Speed	速度
Optional note	可选备注
Observation note	观察备注
Edit Purpose	修改 Purpose
Edit Sensors	修改 Sensors
Edit Actuators	修改 Actuators
Edit Logic	修改 Logic
Stage reflection: What did you change, and what did you observe?	阶段反思：你修改了什么？观察到了什么？
Continue to next stage	继续下一阶段
Finish & reflect	完成并反思
My goal or task priority	我的目标或任务优先事项
My sensors	我的 Sensors
My rules	我的规则
My actuators	我的 Actuators
Reflect on your design	反思你的设计
What did you change about your robot, and how did that affect its behavior?	你对机器人做了哪些修改？这些修改如何影响它的行为？
Your robot design	你的机器人设计
No recorded passing run.	没有已记录的达标运行。
Latest run:	最近一次运行：
all criteria achieved	所有标准均已达到
criteria unmet	尚未达到所有标准
No run recorded	没有运行记录
Download log	下载日志
Priority:	优先事项：
Vacuum the floor	清扫地板
Vacuum Floor	清扫地板
Pick up and sort scattered objects	拾取并分类散落物品
Sort Objects	物品分类
Detect and clean spills	检测并清理洒出的液体
Clean Spills	清理液体
Detect and avoid the moving cat	检测并避让移动的猫
Avoid Cat	避让猫
Slow down near participants	靠近参与者时减速
Slow Near Humans	靠近人时减速
Return to charging dock when battery is low	低电量时返回充电座
Dock on Low Battery	低电量时对接充电
Add pickup and sorting	增加拾取与分类任务
Add spill cleaning	增加清理液体任务
Add stopping for the cat	增加遇猫停车任务
Add slowing for people	增加靠近人时减速任务
Add low-battery docking	增加低电量对接任务
Vacuum dirt from the apartment floor.	清扫公寓地板上的灰尘。
Pick up scattered objects and choose their correct destinations.	拾取散落的物品，并选择正确的放置地点。
Clean spills with the mop and keep vacuum suction off liquid.	用拖把清理液体，避免在液体上开启吸尘。
Stop when the moving cat enters sensing range.	移动的猫进入感知范围时停车。
Slow near the participant and resume normal speed after leaving.	靠近参与者时减速，远离后恢复正常速度。
Select the dock when battery is low and physically engage its connector.	低电量时选择充电座，并用实体连接器完成对接。
Move across the floor grid, change direction to cover all areas, and physically remove dirt from cells on contact.	在地板网格上移动，改变方向以覆盖各区域，接触脏网格时清除灰尘。
Clean percentage of dirty floor cells without missing spots.	清洁脏地板网格的比例，避免遗漏。
Navigate to scattered objects, orient toward each, extend arm and grab, carry to destination (trash bin or table), release, and retract arm.	移动到散落物品前并对准它，伸出机械臂抓取，将其运到目的地（垃圾桶或桌子），松开物品后收回机械臂。
Identify trash vs belongings, deposit trash in bin and belongings on table.	区分垃圾和个人物品：垃圾放进垃圾桶，个人物品放在桌上。
Navigate to wet cell locations and deploy mop pad until cell is dry and clean. Vacuum suction must NOT be used on wet cells!	移动到潮湿网格并放下拖布，直到网格干燥洁净。禁止在潮湿网格上开启吸尘！
Mop all wet liquid cells while keeping vacuum deactivated over liquid.	拖干所有液体网格，并在液体上保持吸尘关闭。
Stop immediately when the moving cat crosses the path (faster than normal deceleration), pause, and reroute safely without disruption.	移动的猫穿过路径时立即停车（比正常减速更快），等待后安全绕行，避免干扰它。
Zero collisions with the roaming cat; quick emergency stop within 1.5m.	不与游走的猫碰撞；猫进入 1.5m 范围时快速急停。
When the human operator/participant avatar is within 2 meters, reduce speed to slow; resume normal speed once they leave.	操作者或参与者的角色进入 2 米范围时减速；离开后恢复正常速度。
Maintain slow speed while avatar is within 2m proximity.	参与者角色在 2m 范围内时保持低速。
When battery drops below the configured LOW threshold (default 30%), abandon active tasks, navigate directly to the charging dock, and engage docking connector pin.	电量低于配置的 LOW 阈值（默认 30%）时，停止当前任务，直接返回充电座并接合充电连接针。
Successfully dock and begin charging before battery reaches 0%.	在电量降至 0% 之前完成对接并开始充电。
Presence and position of tagged cat within 1.5m radius. Returns DETECTED / CLEAR.	检测 1.5m 半径内带标签的猫是否存在及其位置。返回 DETECTED / CLEAR。
LOW below the researcher-configured threshold (default 30%); otherwise HIGH above 60% and MED at lower levels.	低于研究者配置的阈值（默认 30%）时返回 LOW；其余情况下，高于 60% 返回 HIGH，较低时返回 MED。
Direction and distance to the learner-selected BIN, TABLE or DOCK.	感知学习者选定的 BIN、TABLE 或 DOCK 的方向与距离。
Distance to nearest obstacle in 4 directions (front, back, left, right) up to 5m.	检测前、后、左、右四个方向上最近障碍物的距离，最远 5m。
Optical dirt reflection on current cell directly underfoot. Returns DIRTY / CLEAN.	用光学反射检测正下方当前网格的灰尘。返回 DIRTY / CLEAN。
Moisture conductivity on current cell underfoot. Returns WET / DRY.	检测正下方当前网格的水分导电性。返回 WET / DRY。
Static floor layout and visited coverage; records dirt and wet cells only after detection by mounted local sensors.	感知静态地板布局与已走过的区域；只有已安装的局部 Sensors 检测后，才会记录灰尘或潮湿网格。
Mechanical contact sensor on gripper fingers. Returns GRIPPING / EMPTY.	检测夹爪指部的机械接触。返回 GRIPPING / EMPTY。
Infrared beacon detecting participant avatar within 2m radius. Returns NEAR / CLEAR.	通过红外信标检测 2m 半径内的参与者角色。返回 NEAR / CLEAR。
Ambient room illumination in lux: DARK / DIM / BRIGHT.	检测房间环境照度（勒克斯）：DARK / DIM / BRIGHT。
Approximate weight in grams of object contacting the arm.	检测接触机械臂的物品的大致重量，单位为克。
Elapsed time of current task or state in seconds. Returns ELAPSED TIME.	检测当前任务或状态已经持续的秒数。返回 ELAPSED TIME。
Ambient room noise level in decibels: QUIET / LOUD.	检测房间环境噪声（分贝）：QUIET / LOUD。
Floor drop-off / cliff edge ahead: EDGE DETECTED / CLEAR.	检测前方地板落差或悬边：EDGE DETECTED / CLEAR。
Identifies objects within a bounded 120° forward cone, including the object visibly held ahead of its own gripper: CUP, FOOD or TRASH.	识别前方 120° 锥形范围内的物品，包括夹爪前方可见的已抓取物品：CUP、FOOD 或 TRASH。
Spins drive wheels to move forward or backward. Speed is dynamically adjustable.	转动车轮，使机器人前进或后退。速度可动态调节。
Rotates the chassis in place left or right by discrete angles (45°, 90°, 180°).	使底盘原地向左或向右转动指定角度（45°、90°、180°）。
Immediately halts all wheel motion in current tick (bypasses deceleration inertia).	在当前 tick 立即停止所有车轮运动（跳过减速惯性）。
Activates cyclonic suction on undercarriage. Cleans dry DIRTY cells within 1s.	开启底盘下方的旋风吸尘。可在 1 秒内清洁干燥的 DIRTY 网格。
Lowers microfiber absorbent mop pad onto floor. Cleans WET liquid spills in 2s.	将超细纤维吸水拖布放到地面。可在 2 秒内清理 WET 液体。
Telescopes robotic arm forward up to 0.6m toward detected target object.	向检测到的目标物品伸出机械臂，最远 0.6m。
Closes robotic gripper fingers around adjacent target object; locks grip.	合拢夹爪，抓住相邻目标物品并锁紧。
Opens gripper fingers to release held object into target bin or table.	张开夹爪，将抓住的物品放入目标垃圾桶或放到桌上。
Folds mechanical arm back into compact home compartment flush with chassis.	将机械臂折叠收回底盘的收纳舱。
Extends charging pin into wall dock receptacle when within 0.2m to initiate fast charge.	在 0.2m 范围内将充电针伸入墙上充电座，开始快充。
Pulses 360° LED halo strip: Red (blocked/error), Amber (caution), Blue (active/cleaning).	让 360° LED 灯带闪烁：红色（受阻或错误）、琥珀色（注意）、蓝色（工作或清洁）。
Transmits 2.4GHz RF pulse to trigger smart trash bin lid servo before item deposit.	放入物品前发送 2.4GHz 射频脉冲，触发智能垃圾桶开盖。
Emits auditory alert signals: short confirmation beep, or warning chime.	发出声音提示：简短确认蜂鸣或警告铃声。
Redundant hardware speed dial for robotic arm extension.	用于调节机械臂伸出速度的冗余硬件旋钮。
Adjusts how quickly the robotic arm extends.	调节机械臂伸出的速度。
Detects the tagged cat within 1.5m.	检测 1.5m 范围内带标签的猫。
LOW below the configured threshold (default 30%); otherwise HIGH above 60% or MED.	低于配置阈值（默认 30%）时返回 LOW；其余情况下，高于 60% 返回 HIGH，否则返回 MED。
Direction and distance to the learner-selected BIN, TABLE or DOCK; no automatic classification.	感知学习者选定的 BIN、TABLE 或 DOCK 的方向与距离；不会自动分类。
Nearest obstacle in 4 directions up to 5m.	检测四个方向上最近的障碍物，最远 5m。
Underfoot cell state: DIRTY / CLEAN.	正下方网格的状态：DIRTY / CLEAN。
Underfoot cell moisture: WET / DRY.	正下方网格的湿度：WET / DRY。
Static floor layout and visited coverage; remembers dirt or wet cells only when a mounted local sensor observes them.	感知静态布局和已走过的区域；只有已安装的局部 Sensor 观察后，才会记住灰尘或潮湿网格。
Arm holding an object: GRIPPING / EMPTY.	机械臂是否抓住物品：GRIPPING / EMPTY。
Operator avatar within 2m: NEAR / CLEAR.	操作者角色是否在 2m 范围内：NEAR / CLEAR。
Ambient room lighting in lux.	房间环境照度，单位为勒克斯。
Weight of contacting object in grams.	接触物品的重量，单位为克。
Elapsed duration of current state in seconds.	当前状态已持续的时间，单位为秒。
Acoustic decibel level in room.	房间噪声的分贝数。
Drop-off / cliff detection ahead.	检测前方落差或悬边。
Classifies objects in 120° cone: CUP/FOOD/TRASH; includes a visibly held object.	分类 120° 锥形范围内的物品：CUP/FOOD/TRASH；包括可见的已抓取物品。
Distance sensor returns NEAR in front/back/sides.	Distance Sensor 在前、后或两侧返回 NEAR。
Distance sensor returns BLOCKED (<0.3m ahead).	Distance Sensor 返回 BLOCKED（前方距离小于 0.3m）。
Dirt sensor reads DIRTY on current cell.	Floor Dirt Sensor 在当前网格读到 DIRTY。
Wet sensor reads WET moisture on current cell.	Floor Wet Sensor 在当前网格读到 WET。
Map sensor shows cell as UNVISITED.	Floor Map Sensor 将网格标记为 UNVISITED。
Floor cell is already CLEAN.	地板网格已是 CLEAN。
Animal sensor returns DETECTED (cat within 1.5m).	Animal Detection Sensor 返回 DETECTED（猫在 1.5m 范围内）。
Battery sensor reads LOW below the configured threshold (default 30%).	Battery Sensor 在电量低于配置阈值（默认 30%）时读到 LOW。
Battery sensor reads HIGH (>60%).	Battery Sensor 读到 HIGH（高于 60%）。
Destination sensor distance <= 0.2m.	Destination Sensor 检测的距离不超过 0.2m。
Destination distance > 2m.	到目的地的距离大于 2m。
Human proximity reads NEAR (<2m).	Human Proximity Sensor 读到 NEAR（小于 2m）。
Human proximity reads CLEAR (>2m).	Human Proximity Sensor 读到 CLEAR（大于 2m）。
Grip sensor confirms object is secured.	Grip Sensor 确认物品已被抓牢。
Gripper claw is empty / released.	夹爪为空或已松开物品。
Vision classifies targeted item as TRASH.	Vision Sensor 将目标物品识别为 TRASH。
Vision classifies targeted item as CUP or FOOD.	Vision Sensor 将目标物品识别为 CUP 或 FOOD。
Task state duration > timeout threshold.	任务状态持续时间超过超时阈值。
Stair edge sensor flags cliff edge.	Stair Edge Detector 检测到悬边。
Wet sensor reads DRY underfoot.	Floor Wet Sensor 在正下方读到 DRY。
Animal sensor reports no cat within 1.5m.	Animal Detection Sensor 报告 1.5m 内没有猫。
Object weight sensor reads > 0g.	Object Weight Sensor 读数大于 0g。
Drive forward at current speed setting.	按当前设定速度向前行驶。
Reverse drive straight back.	沿直线向后倒退。
Pivot 90° counterclockwise in place.	原地逆时针旋转 90°。
Pivot 90° clockwise in place.	原地顺时针旋转 90°。
Make a full U-turn in place.	原地掉头。
Halt all wheels immediately this tick.	在当前 tick 立即停止所有车轮。
Reduce drive speed to 0.4 m/s.	将行驶速度降到 0.4 m/s。
Restore drive speed to 1.0 m/s.	将行驶速度恢复到 1.0 m/s。
Start suction impeller (cleans dirty cells).	开启吸尘叶轮（清洁脏网格）。
Turn off suction to conserve battery.	关闭吸尘以节省电量。
Lower wet mop pad to clean spills.	放下拖布以清理液体。
Lift mop pad back into undercarriage bay.	提起拖布并收回底盘舱。
Telescope arm forward toward target item.	向目标物品伸出机械臂。
Close motorized claw fingers around object.	合拢电动夹爪以抓住物品。
Open claw fingers to drop/deposit object.	张开夹爪以放下物品。
Fold robotic arm flush against body.	折叠机械臂并收回机身。
Lock charging pin into wall dock.	将充电针锁入墙上充电座。
Pulse chassis light ring Red (warning/blocked).	让底盘灯环闪红光（警告或受阻）。
Pulse chassis light ring Amber (caution).	让底盘灯环闪琥珀色光（注意）。
Pulse chassis light ring Blue (active clean).	让底盘灯环闪蓝光（正在清洁）。
Transmit wireless open command to smart bin.	向智能垃圾桶发送无线开盖指令。
Emit short acoustic confirmation beep.	发出简短的确认蜂鸣。
Choose BIN as the navigation goal. Destination sensing and locomotion are still required to travel.	选择 BIN 作为导航目标。移动仍需要目的地感知和行走部件。
Choose TABLE as the navigation goal; the learner decides which objects belong there.	选择 TABLE 作为导航目标；哪些物品应放在这里由学习者决定。
Choose DOCK as the navigation goal. Connecting requires the physical dock connector.	选择 DOCK 作为导航目标。完成对接需要实体充电连接器。
Emit harmonic alert chime.	发出和谐的提示铃声。
Loops the action until condition clears.	重复执行动作，直到条件不再成立。
Repeats action continuously while condition holds.	条件成立时持续重复执行动作。
Pauses 2s (20 ticks) before firing action.	等待 2 秒（20 ticks）后执行动作。
Chains primary action with secondary action in sequence.	按顺序连接主要动作与后续动作。
Wins arbitration against conflicting rules this tick.	在当前 tick 与冲突规则竞争时优先执行。
Standard execution priority.	标准执行优先级。
Loading 3D Apartment Model (GLB)...	正在加载三维公寓模型（GLB）……
Initializing 360° Interactive Environment...	正在初始化 360° 交互环境……
✕ Dismiss loading overlay	✕ 关闭加载提示
🤖 Focus Robot	🤖 定位机器人
🎥 Follow Robot	🎥 跟随机器人
🎥 Following...	🎥 正在跟随……
⛶ Center Map	⛶ 地图居中
Instantly center camera on cleaning robot	将镜头立即居中到清洁机器人
Lock camera to follow cleaning robot	锁定镜头以跟随清洁机器人
Reset Camera to Center Apartment	将镜头重置到公寓中央
Current stage	当前阶段
Play/Pause Simulation	运行或暂停模拟
Reset Simulation	重置模拟
Stamp Observation:	标记观察：
Mark Specification Match (✓)	标记符合预期（✓）
Mark Specification Violation (✗)	标记不符合预期（✗）
Mark Uncertain / Needs Review (?)	标记不确定或需要检查（?）
Open Step 5 Lab ↗	打开第 5 步工作台 ↗
Interactive 3D 360° Orbit (Apartment.glb)	三维 360° 环绕视图（Apartment.glb）
First-Person 360° Walkthrough	第一人称 360° 漫游
Enter or exit the robot's first-person camera	进入或退出机器人第一人称镜头
Toggle sound effects	开关音效
🔊 On	🔊 开
🔇 Off	🔇 关
📋 Workstation	📋 工作台
Close to Fullscreen Map (Esc)	关闭并返回全屏地图（Esc）
✕ Close [Esc]	✕ 关闭 [Esc]
Exit Robot POV	退出 Robot POV
Esc to exit	按 Esc 退出
🤖 Robot camera follows movement and heading • Exit Robot POV or Esc to return	🤖 机器人镜头跟随移动和朝向 • 退出 Robot POV 或按 Esc 返回
🖱️ Orbit	🖱️ 环绕
Left-Drag 360°	按住左键拖动，旋转 360°
📜 Zoom	📜 缩放
Wheel	鼠标滚轮
📐 Pan	📐 平移
Right-Drag	按住右键拖动
🎮 Move	🎮 移动
WASD / Arrows	WASD / 方向键
🎯 Stations	🎯 工作站
Click 3D Ring	点击三维光环
🚶 Walk	🚶 行走
👁️ Look 360°	👁️ 360° 查看
Drag Mouse	拖动鼠标
Walk to Ring & [SPACE]	走到光环旁并按 [SPACE]
🖱️ Pan	🖱️ 平移
Drag	拖动
Q / E Keys	Q / E 键
SIM PAUSED	模拟已暂停
SIM RUNNING	模拟运行中
RUNNING	运行中
PAUSED	已暂停
Living Room	客厅
LIVING ROOM	客厅
Kitchen	厨房
KITCHEN	厨房
Dining Room	餐厅
DINING ROOM	餐厅
Master Bedroom	主卧
MASTER BEDROOM	主卧
Bedroom	卧室
Bathroom	浴室
BATHROOM	浴室
Hallway / Foyer	走廊 / 门厅
HALLWAY / FOYER	走廊 / 门厅
Charging Dock	充电座
Crumpled Paper	揉皱的纸
Soda Can	汽水罐
Ceramic Mug	陶瓷杯
Cat Food Bowl	猫粮碗
Bin	垃圾桶
Bin · lid open	垃圾桶 · 盖子已打开
Belongings destination	个人物品放置处
🐱 Roaming Cat	🐱 游走的猫
🤖 CLEANING ROBOT	🤖 清洁机器人
👤 You	👤 你
Exploring	正在探索
Rule did not fire	规则未触发
Waiting 2 seconds	正在等待 2 秒
built-in reflex — collision stop and turn	内置反射——碰撞后停车并转向
READY	就绪
READY / CRUISING	就绪 / 巡航
MOPPING	正在拖地
STOPPED	已停止
IDLE	待机
Hidden Spill: Your robot cannot see liquid puddles until it arrives directly over them.	隐蔽液体：机器人只有走到液体正上方时才能检测到它。
Roaming Pet: This obstacle moves! Your robot's static map may quickly become invalid.	游走宠物：这个障碍物会移动！机器人的静态地图可能很快不再适用。
Cluttered Living Space: Multiple continuous trajectories exist through furniture.	拥挤的生活空间：家具之间存在多条连续可走的路径。
Thin Hallway Cable: Acoustic distance sonars can miss it; floor SLAM detects it.	走廊细电线：声学测距可能漏检它，地面 SLAM 可以检测到。
Charging Station: Requires reliable coordinate localization for docking return.	充电站：返回对接需要可靠的坐标定位。
Never vacuumed.	从未开启吸尘。
Vacuum ran but nothing was cleaned.	吸尘运行过，但没有清洁任何网格。
Never grabbed anything.	从未抓取物品。
Never mopped.	从未使用拖把。
Mop ran but nothing was cleaned.	拖把运行过，但没有清理任何液体。
Stopped for the cat every time.	每次遇到猫都停车了。
Moved near the cat without stopping.	靠近猫时移动但没有停车。
No moving encounter with the cat.	移动时尚未遇到猫。
Slowed down for the person every time.	每次遇到人都减速了。
Moved near the person without slowing.	靠近人时移动但没有减速。
No moving encounter with the person.	移动时尚未遇到人。
Battery ran out before docking.	完成对接前电量耗尽。
Reached the dock but never connected.	已到达充电座，但没有连接。
Never approached the dock.	从未靠近充电座。
`.trim().split('\n').map(line => line.split('\t')));

// Module cards display the first sentence of a catalog description.
for (const [source, chinese] of Object.entries(ZH)) {
  const first = source.split(/(?<=[.!?])\s/)[0];
  if (first !== source && !ZH[first]) ZH[first] = chinese.split('。')[0] + '。';
}
