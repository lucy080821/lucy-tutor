// Kho kiến thức Lucy Run. Từ vựng: "từ|nghĩa|CEFR|câu ví dụ (chứa đúng từ)".
// Ngữ pháp: "câu có ___|đáp án|sai 1|sai 2|từ khoá dấu hiệu (có trong câu)|giải thích|CEFR".
const VOCAB_TOPICS = [
  { id: "family", name: "Gia đình & con người", desc: "Người thân, tính cách, quan hệ", levels: {
    easy: `mother|mẹ|A1|My mother cooks dinner every evening.
brother|anh trai, em trai|A1|My brother is ten years old.
friendly|thân thiện|A1|Our new neighbour is very friendly.
cousin|anh chị em họ|A2|My cousin lives in Da Nang.
grandparents|ông bà|A2|I visit my grandparents every Sunday.
twins|cặp sinh đôi|A2|The twins look exactly the same.`,
    medium: `relative|họ hàng|B1|Every relative came to the wedding.
generous|hào phóng|B1|She is generous with her time and money.
argue|cãi nhau|B1|My sisters often argue about clothes.
childhood|thời thơ ấu|B1|He spent his childhood in the countryside.
reliable|đáng tin cậy|B1|A good friend is always reliable.
get along|hoà thuận|B1|I get along well with my stepbrother.`,
    hard: `upbringing|sự nuôi dạy|B2|Her strict upbringing made her very disciplined.
bond|sự gắn bó|B2|There is a strong bond between the two brothers.
sibling|anh chị em ruột|B2|Each sibling has a different personality.
resilient|kiên cường|C1|Children are often more resilient than adults think.
estranged|bị xa cách, ghẻ lạnh|C1|He has been estranged from his father for years.
nurture|nuôi dưỡng|C1|Parents should nurture their children's curiosity.` } },
  { id: "school", name: "Trường học & học tập", desc: "Lớp học, thi cử, đại học", levels: {
    easy: `classroom|lớp học|A1|Our classroom is on the second floor.
homework|bài tập về nhà|A1|I do my homework after dinner.
subject|môn học|A1|Maths is my favourite subject.
timetable|thời khoá biểu|A2|Check the timetable for tomorrow's lessons.
exam|kỳ thi|A2|We have a big exam next week.
library|thư viện|A2|I borrow books from the school library.`,
    medium: `revise|ôn tập|B1|I need to revise for the history test.
knowledge|kiến thức|B1|Reading books improves your knowledge.
scholarship|học bổng|B1|She won a scholarship to study in Japan.
graduate|tốt nghiệp|B1|My sister will graduate from university next year.
fail|trượt, thi rớt|B1|Don't worry if you fail the first time.
attend|theo học, tham dự|B1|Over 800 students attend this school.`,
    hard: `curriculum|chương trình học|B2|The new curriculum includes more science lessons.
assessment|sự đánh giá|B2|Teachers use regular assessment to track progress.
tuition|học phí|B2|University tuition has risen sharply.
plagiarism|đạo văn|C1|Plagiarism can get you expelled from university.
rigorous|nghiêm ngặt, khắt khe|C1|The course has a rigorous selection process.
pedagogy|phương pháp sư phạm|C1|Modern pedagogy puts learners at the centre.` } },
  { id: "food", name: "Đồ ăn & nấu nướng", desc: "Món ăn, nấu ăn, dinh dưỡng", levels: {
    easy: `bread|bánh mì|A1|I eat bread with eggs for breakfast.
rice|cơm, gạo|A1|We have rice with every meal.
hungry|đói|A1|I'm hungry, let's eat now.
delicious|ngon|A2|This soup is delicious!
vegetable|rau củ|A2|A carrot is a vegetable.
menu|thực đơn|A2|Can I see the menu, please?`,
    medium: `recipe|công thức nấu ăn|B1|My grandma gave me her recipe for pho.
ingredient|nguyên liệu|B1|Flour is the main ingredient in bread.
spicy|cay|B1|Thai food is often very spicy.
boil|luộc, đun sôi|B1|Boil the eggs for ten minutes.
diet|chế độ ăn|B1|A healthy diet includes lots of fruit.
portion|khẩu phần|B1|The portion was too big for one person.`,
    hard: `nutritious|bổ dưỡng|B2|Beans are cheap and nutritious.
cuisine|ẩm thực|B2|Vietnamese cuisine is famous around the world.
processed|đã qua chế biến|B2|Try to avoid processed food.
savour|thưởng thức|C1|Take time to savour every bite.
palatable|ngon miệng, dễ ăn|C1|The medicine was made palatable for children.
gastronomy|nghệ thuật ẩm thực|C1|Lyon is a capital of French gastronomy.` } },
  { id: "travel", name: "Du lịch & giao thông", desc: "Đi lại, sân bay, chuyến đi", levels: {
    easy: `bus|xe buýt|A1|I go to school by bus.
ticket|vé|A1|How much is a ticket to Hue?
map|bản đồ|A1|Let's look at the map.
airport|sân bay|A2|We arrived at the airport early.
luggage|hành lý|A2|My luggage is too heavy.
holiday|kỳ nghỉ|A2|We spent our holiday by the sea.`,
    medium: `destination|điểm đến|B1|Ha Long Bay is a popular destination.
journey|chuyến đi|B1|The journey takes about three hours.
passenger|hành khách|B1|Every passenger must wear a seat belt.
delay|sự chậm trễ|B1|There was a long delay because of the storm.
souvenir|quà lưu niệm|B1|I bought a souvenir for my mum.
accommodation|chỗ ở|B1|We booked our accommodation online.`,
    hard: `itinerary|lịch trình|B2|Our itinerary includes three cities in five days.
commute|quãng đi làm, đi học hằng ngày|B2|My commute takes forty minutes.
congestion|sự tắc nghẽn|B2|Traffic congestion is a big problem in Hanoi.
wanderlust|niềm đam mê xê dịch|C1|Her wanderlust took her to forty countries.
secluded|hẻo lánh, biệt lập|C1|They found a secluded beach.
embark|bắt đầu (chuyến đi)|C1|We embark on our trip tomorrow morning.` } },
  { id: "work", name: "Công việc & nghề nghiệp", desc: "Nghề, phỏng vấn, sự nghiệp", levels: {
    easy: `doctor|bác sĩ|A1|The doctor works at a big hospital.
teacher|giáo viên|A1|My teacher is very kind.
office|văn phòng|A1|My dad works in an office.
job|công việc|A2|She has a new job at a bank.
busy|bận rộn|A2|I'm busy at work today.
farmer|nông dân|A2|The farmer grows rice and corn.`,
    medium: `salary|tiền lương|B1|He earns a good salary.
interview|buổi phỏng vấn|B1|I have a job interview on Monday.
colleague|đồng nghiệp|B1|My colleague helped me with the report.
experience|kinh nghiệm|B1|Do you have any experience in sales?
career|sự nghiệp|B1|She wants a career in medicine.
deadline|hạn chót|B1|The deadline for the project is Friday.`,
    hard: `promotion|sự thăng chức|B2|She got a promotion after two years.
resign|từ chức|B2|He decided to resign from his job.
negotiate|đàm phán|B2|We need to negotiate a better contract.
entrepreneur|doanh nhân khởi nghiệp|C1|The young entrepreneur started three companies.
lucrative|béo bở, sinh lời cao|C1|Software is a lucrative industry.
redundancy|sự cắt giảm nhân sự|C1|The factory announced a wave of redundancy.` } },
  { id: "health", name: "Sức khoẻ & cơ thể", desc: "Bệnh, thuốc, lối sống", levels: {
    easy: `head|cái đầu|A1|My head hurts.
tired|mệt|A1|I'm tired after the game.
sick|bị ốm|A1|She is sick today.
medicine|thuốc|A2|Take this medicine twice a day.
exercise|tập thể dục|A2|I exercise every morning.
dentist|nha sĩ|A2|I go to the dentist twice a year.`,
    medium: `symptom|triệu chứng|B1|A fever is a common symptom of flu.
injury|chấn thương|B1|He has a knee injury.
recover|hồi phục|B1|She needs a week to recover.
stress|sự căng thẳng|B1|Exams can cause a lot of stress.
balanced|cân bằng|B1|Eat a balanced meal every day.
appointment|cuộc hẹn (khám bệnh)|B1|I made an appointment with the doctor.`,
    hard: `immune|(thuộc) miễn dịch|B2|Sleep helps your immune system.
chronic|mãn tính|B2|He suffers from chronic back pain.
therapy|liệu pháp|B2|Music therapy can reduce anxiety.
sedentary|ít vận động|C1|A sedentary lifestyle is bad for your heart.
ailment|bệnh vặt|C1|A cold is a common ailment in winter.
prognosis|tiên lượng bệnh|C1|The doctor gave a good prognosis.` } },
  { id: "environment", name: "Môi trường & thiên nhiên", desc: "Thời tiết, ô nhiễm, khí hậu", levels: {
    easy: `tree|cái cây|A1|There is a big tree in our garden.
river|dòng sông|A1|The river is very long.
rain|mưa|A1|It will rain this afternoon.
weather|thời tiết|A2|The weather is hot today.
rubbish|rác|A2|Put your rubbish in the bin.
recycle|tái chế|A2|We recycle paper and bottles.`,
    medium: `pollution|sự ô nhiễm|B1|Air pollution is bad in big cities.
protect|bảo vệ|B1|We must protect wild animals.
wildlife|động vật hoang dã|B1|The park is home to a lot of wildlife.
flood|lũ lụt|B1|The flood destroyed many houses.
energy|năng lượng|B1|Solar energy is clean and cheap.
waste|lãng phí|B1|Don't waste water.`,
    hard: `sustainable|bền vững|B2|We need more sustainable farming.
deforestation|nạn phá rừng|B2|Deforestation destroys animal homes.
habitat|môi trường sống|B2|The panda's habitat is shrinking.
biodiversity|đa dạng sinh học|C1|Coral reefs have rich biodiversity.
deplete|làm cạn kiệt|C1|We deplete natural resources too fast.
mitigate|giảm nhẹ|C1|Planting trees can mitigate climate change.` } },
  { id: "tech", name: "Công nghệ & truyền thông", desc: "Thiết bị, internet, mạng xã hội", levels: {
    easy: `phone|điện thoại|A1|Can I use your phone?
computer|máy tính|A1|I play games on my computer.
email|thư điện tử|A1|Send me an email tonight.
website|trang web|A2|Our school has a new website.
password|mật khẩu|A2|Never share your password.
download|tải xuống|A2|You can download the app for free.`,
    medium: `device|thiết bị|B1|Please turn off your device during the test.
online|trực tuyến|B1|I take English lessons online.
screen|màn hình|B1|Don't look at a screen for too long.
update|cập nhật|B1|You should update your apps regularly.
social media|mạng xã hội|B1|Teenagers spend hours on social media.
invent|phát minh|B1|Scientists invent new tools every year.`,
    hard: `algorithm|thuật toán|B2|The app uses an algorithm to suggest videos.
privacy|quyền riêng tư|B2|Protect your privacy online.
cyberbullying|bắt nạt trên mạng|B2|Schools are fighting cyberbullying.
misinformation|thông tin sai lệch|C1|Misinformation spreads quickly on the internet.
obsolete|lỗi thời|C1|Floppy disks are now obsolete.
encrypt|mã hoá|C1|Banks encrypt your data to keep it safe.` } },
];

const GRAMMAR_TOPICS = [
  { id: "tenses", name: "Thì động từ", desc: "Hiện tại, quá khứ, hoàn thành, tương lai", levels: {
    easy: `She ___ to school every day.|goes|go|going|every day|Hiện tại đơn, chủ ngữ số ít (she/he/it) thì động từ thêm -s/-es.|A1
Look! The baby ___.|is sleeping|sleeps|sleep|look|"Look!" báo hiệu việc đang xảy ra → hiện tại tiếp diễn: am/is/are + V-ing.|A1
They ___ football now.|are playing|play|played|now|"now" → hiện tại tiếp diễn.|A1
I ___ my grandma yesterday.|visited|visit|visiting|yesterday|"yesterday" → quá khứ đơn: V-ed hoặc cột 2.|A2
We ___ at home last night.|were|was|are|last night|"last night" → quá khứ đơn; we/you/they đi với were.|A2
He ___ TV when I called him.|was watching|watched|watches|when|Việc đang diễn ra trong quá khứ (was/were + V-ing) thì việc khác xen vào (quá khứ đơn).|A2`,
    medium: `I ___ here since 2020.|have lived|lived|live|since|since + mốc thời gian → hiện tại hoàn thành: have/has + V3.|B1
She has just ___ her homework.|finished|finish|finishing|just|have/has + just + V3: vừa mới làm xong.|B1
Have you ever ___ to Japan?|been|gone|go|ever|"Have you ever been to…?" hỏi về trải nghiệm.|B1
Tomorrow I ___ my aunt. It's all planned.|am going to visit|visit|visited|tomorrow|Kế hoạch đã định trước → be going to + V.|B1
By the time we arrived, the film ___.|had started|started|has started|by the time|Việc xảy ra trước một mốc quá khứ → quá khứ hoàn thành: had + V3.|B1
Look at those dark clouds. It ___ rain.|is going to|will|rains|clouds|Dự đoán có dấu hiệu rõ ràng trước mắt → be going to.|B1`,
    hard: `She ___ for three hours when the bus finally came.|had been waiting|was waiting|has waited|hours|Việc kéo dài liên tục đến một mốc quá khứ → had been + V-ing.|B2
By next June, I ___ from university.|will have graduated|will graduate|graduate|by next|By + mốc tương lai → tương lai hoàn thành: will have + V3.|B2
This time tomorrow, we ___ over the Pacific.|will be flying|will fly|fly|this time|Việc đang diễn ra tại một thời điểm tương lai → will be + V-ing.|B2
Hardly ___ the house when it started to rain.|had I left|I had left|did I leave|hardly|Đảo ngữ: Hardly + had + S + V3 + when…|C1
No sooner ___ down than the phone rang.|had she sat|she had sat|she sat|no sooner|Đảo ngữ: No sooner + had + S + V3 + than…|C1
It's high time we ___ home.|went|go|will go|high time|It's (high) time + S + V2: đã đến lúc phải làm gì.|C1` } },
  { id: "conditionals", name: "Câu điều kiện & câu ước", desc: "If, unless, wish, đảo ngữ", levels: {
    easy: `If you heat ice, it ___.|melts|melted|melting|heat|Loại 0: sự thật hiển nhiên, cả hai vế dùng hiện tại đơn.|A2
If it rains, we ___ at home.|will stay|stayed|would stay|rains|Loại 1: If + hiện tại đơn, S + will + V.|A2
If you ___ hard, you will pass.|study|studied|will study|pass|Loại 1: vế If dùng hiện tại đơn, không dùng will.|A2
You can go out ___ you finish your homework.|if|but|so|finish|"if" nối điều kiện: nếu.|A1
Unless you hurry, you ___ late.|will be|are|would be|unless|Unless = if not; vế chính vẫn là will + V.|A2
Take an umbrella ___ it rains.|in case|because|so that|umbrella|in case: phòng khi.|A2`,
    medium: `If I ___ rich, I would travel the world.|were|am|will be|rich|Loại 2: điều không có thật ở hiện tại; dùng were cho mọi ngôi.|B1
If she had more time, she ___ a new language.|would learn|will learn|learns|time|Loại 2: If + V2, S + would + V.|B1
I wish I ___ taller.|were|am|will be|wish|Ước điều trái hiện tại: wish + quá khứ đơn (were).|B1
What would you do if you ___ a lion?|saw|see|will see|lion|Loại 2 trong câu hỏi giả định.|B1
I wish it ___ raining. I want to play outside.|would stop|stops|will stop|wish|wish + would + V: mong điều gì đó thay đổi.|B1
If I were you, I ___ apologise.|would|will|am|apologise|Lời khuyên: If I were you, I would + V.|B1`,
    hard: `If I had studied harder, I ___ the exam.|would have passed|would pass|will pass|harder|Loại 3: If + had V3, S + would have V3 (trái quá khứ).|B2
If she ___ the bus, she wouldn't have been late.|hadn't missed|didn't miss|wouldn't miss|late|Loại 3: vế If dùng quá khứ hoàn thành.|B2
I wish I ___ to the party last night.|had gone|went|would go|last night|Ước trái quá khứ: wish + had + V3.|B2
___ I known, I would have helped you.|Had|If|Were|known|Đảo ngữ loại 3: Had + S + V3 = If S had V3.|C1
If he had taken the job, he ___ rich now.|would be|would have been|will be|now|Điều kiện hỗn hợp: giả định quá khứ → kết quả ở hiện tại.|C1
___ you need any help, call me.|Should|Would|Had|call|Đảo ngữ loại 1: Should + S + V = If S + V.|C1` } },
  { id: "passive", name: "Câu bị động", desc: "Be + V3, nhờ bảo, bị động khách quan", levels: {
    easy: `English ___ all over the world.|is spoken|speaks|is speak|world|Bị động hiện tại đơn: am/is/are + V3.|A2
This book ___ by my teacher.|was written|wrote|is write|by|"by + người làm" → câu bị động; quá khứ: was/were + V3.|A2
The room ___ every day.|is cleaned|cleans|cleaned|every day|Căn phòng không tự dọn → bị động hiện tại đơn.|A2
My bike ___ yesterday.|was stolen|stole|is stolen|yesterday|Bị động quá khứ đơn: was/were + V3.|A2
Rice ___ in Vietnam.|is grown|grows|is grow|Vietnam|Bị động: is + V3 (grow → grown).|A2
The letters ___ last week.|were sent|was sent|sent|week|Chủ ngữ số nhiều → were + V3.|A2`,
    medium: `The bridge ___ next year.|will be built|will build|is building|next year|Bị động tương lai: will be + V3.|B1
Homework must ___ on time.|be done|do|done|must|Bị động với động từ khuyết thiếu: modal + be + V3.|B1
Three new schools ___ this year.|have been built|built|have built|this year|Bị động hiện tại hoàn thành: have/has been + V3.|B1
The car ___ when I arrived.|was being repaired|was repairing|repaired|when|Bị động quá khứ tiếp diễn: was/were being + V3.|B1
Phones should ___ off in class.|be turned|turn|turned|should|should + be + V3.|B1
The results ___ tomorrow.|will be announced|will announce|announce|tomorrow|Bị động tương lai: will be + V3.|B1`,
    hard: `I had my hair ___ yesterday.|cut|to cut|cutting|hair|Thể nhờ bảo: have + vật + V3.|B2
She got her car ___.|repaired|repair|to repair|car|Thể nhờ bảo: get + vật + V3.|B2
It is said that he ___ very rich.|is|being|to be|said|Bị động khách quan: It is said that + mệnh đề đầy đủ.|B2
He is believed ___ abroad last year.|to have moved|to move|moving|believed|S + be believed + to have V3 (việc xảy ra trước).|C1
The project is reported ___ well now.|to be going|to have gone|going|reported|Việc đang diễn ra: S + be reported + to be V-ing.|C1
The thief is thought ___ the country.|to have left|to leave|leaving|thief|Việc đã xảy ra: be thought + to have V3.|C1` } },
  { id: "clauses", name: "Mệnh đề quan hệ & liên từ", desc: "Who, which, although, despite", levels: {
    easy: `I like apples ___ bananas.|and|but|or|apples|and: nối hai ý giống nhau.|A1
She is tired, ___ she is happy.|but|and|so|tired|but: nối hai ý trái ngược.|A1
I stayed home ___ I was sick.|because|so|but|sick|because: chỉ lý do.|A1
It was raining, ___ we took a taxi.|so|because|but|raining|so: chỉ kết quả.|A2
The man ___ lives next door is a doctor.|who|which|where|doctor|who: thay cho người.|A2
This is the book ___ I bought yesterday.|which|who|where|book|which/that: thay cho vật.|A2`,
    medium: `That's the girl ___ father is a pilot.|whose|who|which|father|whose + danh từ: chỉ sở hữu.|B1
This is the town ___ I was born.|where|which|who|born|where: thay cho nơi chốn.|B1
___ it was cold, we went swimming.|Although|Because|So|cold|Although + mệnh đề: mặc dù.|B1
I remember the day ___ we first met.|when|where|which|day|when: thay cho thời gian.|B1
She speaks English ___ French.|as well as|because|although|speaks|as well as: cũng như, và cả.|B1
He failed ___ he studied hard.|even though|because|so|failed|even though: mặc dù (nhấn mạnh hơn although).|B1`,
    hard: `___ the rain, the match continued.|Despite|Although|Because|rain|Despite + danh từ/V-ing, không đi với mệnh đề.|B2
My brother, ___ lives in Canada, is an engineer.|who|that|whom|Canada|Mệnh đề không xác định (có dấu phẩy) không dùng that.|B2
The woman ___ to the manager is my aunt.|talking|who talking|talked|manager|Rút gọn mệnh đề quan hệ chủ động bằng V-ing.|B2
Some people love cities, ___ others prefer villages.|whereas|despite|unless|others|whereas: trong khi (đối lập hai vế).|C1
The person to ___ I spoke was very helpful.|whom|who|that|spoke|Sau giới từ dùng whom, không dùng who/that.|C1
He is the first student ___ the prize.|to win|winning|won|first|Sau the first/last/only dùng to V để rút gọn.|C1` } },
  { id: "modals", name: "Động từ khuyết thiếu", desc: "Can, must, should, must have…", levels: {
    easy: `I ___ swim very well.|can|cans|to can|swim|can + V nguyên mẫu: có thể, biết làm.|A1
You ___ wear a helmet on a motorbike.|must|musts|to must|helmet|must + V: phải (bắt buộc).|A1
___ I open the window?|Can|Must|Do|window|Can I…? dùng để xin phép.|A1
You ___ smoke in the hospital.|mustn't|must|needn't|hospital|mustn't: cấm, không được phép.|A2
She ___ read when she was four.|could|can|must|when|could: khả năng trong quá khứ.|A2
You ___ see a doctor. You look ill.|should|shouldn't|can't|ill|should: lời khuyên.|A2`,
    medium: `We ___ wear a uniform. It's a school rule.|have to|don't have to|can|rule|have to: bắt buộc do quy định bên ngoài.|B1
You ___ bring food. There's plenty here.|don't have to|must|have to|plenty|don't have to: không cần thiết.|B1
Take a coat. It ___ be cold later.|might|mustn't|has to|later|might: có thể (không chắc chắn).|B1
___ you help me with this box?|Could|Must|Should|box|Could you…? lời nhờ lịch sự.|B1
I ___ to get up early yesterday.|had|must|should|yesterday|Quá khứ của must/have to là had to.|B1
You ___ better hurry or you'll miss the bus.|had|would|should|hurry|had better + V: tốt hơn hết là nên.|B1`,
    hard: `He's not here. He ___ have gone home.|must|can|should|here|must have V3: chắc chắn đã (suy luận về quá khứ).|B2
You ___ have told me! I would have helped.|should|must|can|helped|should have V3: lẽ ra nên làm (nhưng đã không làm).|B2
She ___ have seen us; she was asleep.|can't|mustn't|shouldn't|asleep|can't have V3: không thể nào đã.|B2
We ___ have hurried; the train was late anyway.|needn't|mustn't|can't|anyway|needn't have V3: đã làm nhưng hoá ra không cần.|C1
You ___ as well go home. There's nothing to do.|might|should|must|nothing|might as well + V: chẳng còn gì tốt hơn là.|C1
He ___ have won if he hadn't fallen.|could|must|should|fallen|could have V3: lẽ ra đã có thể (nhưng không xảy ra).|C1` } },
  { id: "comparison", name: "So sánh", desc: "Hơn, nhất, bằng, càng… càng", levels: {
    easy: `An elephant is ___ than a dog.|bigger|big|biggest|than|Tính từ ngắn + -er + than.|A1
My bag is ___ than yours.|heavier|heavy|more heavy|bag|Tính từ tận cùng -y → bỏ y thêm -ier.|A2
This is the ___ day of the year.|hottest|hotter|most hot|year|So sánh nhất: the + adj-est (gấp đôi phụ âm cuối: hot → hottest).|A2
Maths is ___ than art for me.|more difficult|difficulter|most difficult|maths|Tính từ dài: more + adj + than.|A2
She is as tall ___ her mother.|as|than|so|mother|So sánh bằng: as + adj + as.|A2
Tom is the ___ student in my class.|best|better|goodest|class|good → better → best (bất quy tắc).|A2`,
    medium: `This is the ___ film I have ever seen.|most interesting|more interesting|interestingest|ever|So sánh nhất tính từ dài: the most + adj.|B1
My English is getting ___.|better and better|more and more good|best and best|getting|So sánh kép: càng ngày càng (adj-er and adj-er).|B1
He runs ___ than his brother.|faster|more fast|fastly|runs|Trạng từ ngắn: fast → faster.|B1
Today is ___ than yesterday.|worse|badder|more bad|yesterday|bad → worse → worst.|B1
This phone is not as expensive ___ that one.|as|than|like|phone|not as + adj + as: không bằng.|B1
He drives ___ carefully than I do.|more|most|much|drives|Trạng từ dài: more + adv + than.|B1`,
    hard: `The ___ you practise, the better you get.|more|most|much|practise|The + so sánh hơn…, the + so sánh hơn: càng… càng.|B2
This test is ___ easier than the last one.|much|more|very|test|Nhấn mạnh so sánh hơn: much/far/a lot + adj-er.|B2
She is by ___ the best player on the team.|far|much|more|team|by far + so sánh nhất: nhấn mạnh.|B2
Their house is twice ___ big as ours.|as|more|so|twice|So sánh bội số: twice/three times + as + adj + as.|C1
___ the weather got, the happier we were.|The warmer|Warmer|The warmest|happier|Cấu trúc càng… càng: The + adj-er + S + V, the + adj-er…|C1
He is no ___ than his brother; they're both lazy.|better|good|best|lazy|no better than: chẳng hơn gì.|C1` } },
];
