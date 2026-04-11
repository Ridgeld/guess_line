const canvas = document.getElementById('gridCanvas');
const ctx = canvas.getContext('2d');
// const input = document.getElementById('answerInput');
// const submitBtn = document.getElementById('submitBtn');
const popup = document.getElementById('popup');
const title = document.getElementById('title');
// Настройки сетки
const gridStep = 40; 
const cx = canvas.width / 2 + 60; // Центр смещен немного вправо, как на картинке
const cy = canvas.height / 2;

const steerBtn = document.getElementById('steerBtn');
const optionsContainer = document.getElementById('optionsContainer');

const confettiCanvas = document.getElementById('confettiCanvas');
const customConfetti = confetti.create(confettiCanvas, {
    resize: true,    // Автоматически подстраивать под размер окна
    useWorker: true  // Безопасное использование воркеров (библиотека сама все настроит)
});

let isHintVisible = false; // Новая переменная для контроля подсказки
let hintTimeout = null;

let shapesData = [];
let currentShape = null;

const line_color = '#0066FF';
const connect_line_color = '#80B3FF';



const X_color = '#90FF29';
const Y_color = '#FF2946';
const Z_color = '#0066FF';

// 1. Отрисовка фона (сетки)
function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#f0f4f8';
    ctx.lineWidth = 1;

    // Вертикальные линии
    for (let x = 0; x <= canvas.width; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    // Горизонтальные линии
    for (let y = 0; y <= canvas.height; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

// 2. Отрисовка координатных осей
function drawAxes() {
    const arrowSize = 10;

    const drawArrow = (fromX, fromY, toX, toY, color, label) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();

        // Рисуем стрелочку
        const angle = Math.atan2(toY - fromY, toX - fromX);
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - arrowSize * Math.cos(angle - Math.PI / 6), toY - arrowSize * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(toX - arrowSize * Math.cos(angle + Math.PI / 6), toY - arrowSize * Math.sin(angle + Math.PI / 6));
        ctx.fill();

        // Рисуем подпись (X, Y, Z)
        ctx.font = '30px Amatic SC';
        if(label === 'Z') ctx.fillText(label, toX - 5, toY - 15);
        if(label === 'X') ctx.fillText(label, toX - 25, toY + 10);
        if(label === 'Y') ctx.fillText(label, toX - 5, toY + 30);
    };

    // Ось Z (синяя, вверх)
    drawArrow(cx, cy, cx, cy - gridStep * 4, Z_color, 'Z');
    // Ось X (зеленая, влево)
    drawArrow(cx, cy, cx - gridStep * 4.5, cy, X_color, 'X');
    // Ось Y (красная, вниз)
    drawArrow(cx, cy, cx, cy + gridStep * 4, Y_color, 'Y');
}

// 3. Отрисовка случайной фигуры из JSON
function drawShape(shape) {
    if (!shape) return;

    // 1. Отрисовка линий связи (самый нижний слой)
    if (shape.connectionLines && shape.connectionLines.length > 0) {
        ctx.beginPath();
        ctx.strokeStyle = connect_line_color; // Убедись, что переменная объявлена
        ctx.lineWidth = 1;
        
        // ctx.setLineDash([5, 5]); // Раскомментируй, если нужен пунктир

        shape.connectionLines.forEach(line => {
            if (line.length === 2) {
                const p1x = cx - line[0].x * gridStep;
                const p1y = cy - line[0].y * gridStep;
                const p2x = cx - line[1].x * gridStep;
                const p2y = cy - line[1].y * gridStep;

                ctx.moveTo(p1x, p1y);
                ctx.lineTo(p2x, p2y);
            }
        });
        ctx.stroke();
        // ctx.setLineDash([]); // Сброс пунктира
    }

    // 2. Отрисовка основных элементов (линии, дуги, точки, составные контуры)
    if (shape.paths && shape.paths.length > 0) {
        shape.paths.forEach(path => {
            if (!path.points || path.points.length === 0) return;

            // Проверяем формат данных: одномерный массив точек или массив массивов (сегментов)
            // Если первый элемент сам является массивом, значит это мульти-линия
            const isMultiPath = Array.isArray(path.points[0]);
            
            // Приводим данные к единому формату (массив сегментов)
            const segments = isMultiPath ? path.points : [path.points];

            segments.forEach(segment => {
                if (!segment || segment.length === 0) return;

                // --- Проверка на одну точку в сегменте ---
                if (segment.length === 1) {
                    const p = segment[0];
                    const px = cx - p.x * gridStep;
                    const py = cy - p.y * gridStep;

                    ctx.beginPath();
                    ctx.fillStyle = path.color || line_color; 
                    ctx.arc(px, py, 5, 0, Math.PI * 2); 
                    ctx.fill();
                    return; // Завершаем итерацию для этой точки, идем к следующему сегменту
                }

                // --- Если точек больше одной - рисуем линию/дугу ---
                ctx.beginPath();
                ctx.strokeStyle = path.color || line_color; 
                ctx.lineWidth = path.lineWidth || 3;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round'; 

                segment.forEach((p, index) => {
                    const px = cx - p.x * gridStep;
                    const py = cy - p.y * gridStep;

                    if (index === 0) {
                        ctx.moveTo(px, py);
                    } else {
                        ctx.lineTo(px, py);
                    }
                });

                // Если указано closed: true, контур замкнется (применимо к каждому сегменту)
                if (path.closed) {
                    ctx.closePath();
                }
                ctx.stroke();
            });
        });
    }
}
function drawHintText() {
    if (!isHintVisible || !currentShape || !currentShape.answer) return;

    const text = currentShape.answer;
    
    ctx.save();
    ctx.font = 'bold 24px "Amatic SC"'; // Шрифт
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Координаты для текста (сверху по центру)
    const textX = canvas.width / 2;
    const textY = 40;

    // Рисуем полупрозрачную подложку для читаемости

    // Рисуем сам текст
    ctx.fillStyle = Y_color; // Цвет текста подсказки (например, красноватый)
    ctx.fillText(text, textX, textY);
    ctx.restore();
}

// Главная функция рендера сцены
function renderScene() {
    title.textContent = currentShape.type === 'линия' ? "Угадай линию" : "Угадай плоскость"
    drawGrid();
    drawAxes();
    if (currentShape) {
        drawShape(currentShape);
    }
    drawHintText();
}


// Загрузка JSON данных
async function loadData() {
    try {
        const response = await fetch('data.json');
        shapesData = await response.json();
        nextRound();
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        
        // Тестовые данные с новой структурой (массив paths)
        shapesData = [
            {
                "answer": "фронтальная плоскость",
                "type": "линия",
                "paths": [
                    {
                        "points": [{"x": 1, "y": 2.5}, {"x": 4, "y": 2.5}],
                        "closed": false,
                        "color": "#000000"
                    },
                    {
                        "points": [{"x": 4, "y": -0.5}, {"x": 1, "y": -2}],
                        "closed": false,
                        "color": "#000000"
                    },
                    {
                        "points": [{"x": 2, "y": 1}, {"x": 2.5, "y": 1.5}, {"x": 3, "y": 1}], // Имитация дуги
                        "closed": false,
                        "color": "#ff0000",
                        "lineWidth": 2
                    }
                ],
                "connectionLines": [
                    [{"x": 1, "y": 2.5}, {"x": 1, "y": -2}],
                    [{"x": 4, "y": 2.5}, {"x": 4, "y": -0.5}]
                ]
            }
        ];
        nextRound();
    }
}


// Запуск нового раунда
function nextRound() {
    if (shapesData.length === 0) return;
    
    // Сбрасываем подсказку
    isHintVisible = false;
    clearTimeout(hintTimeout);

    // Выбираем случайную фигуру
    const randomIndex = Math.floor(Math.random() * shapesData.length);
    currentShape = shapesData[randomIndex];
    renderScene();

    // Очищаем старые кнопки
    optionsContainer.innerHTML = ''; 

    // Генерируем и отрисовываем новые варианты
    const options = generateOptions(currentShape.answer);
    
    options.forEach(optText => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = optText;
        
        // Вешаем обработчик клика на каждую кнопку
        btn.onclick = () => handleOptionClick(btn, optText, currentShape.answer);
        
        optionsContainer.appendChild(btn);
    });
}
function handleOptionClick(clickedBtn, selectedAnswer, correctAnswer) {
    // Отключаем кнопки
    const allBtns = document.querySelectorAll('.option-btn');
    allBtns.forEach(btn => btn.disabled = true);

    if (selectedAnswer === correctAnswer) {
        // Правильно
        clickedBtn.classList.add('correct');
        
        // --- НОВОЕ: Показываем холст конфетти и запускаем анимацию ---
        confettiCanvas.classList.add('show'); 

                // ИСПРАВЛЕННЫЙ ВЫЗОВ
        customConfetti({
            particleCount: 100, 
            spread: 120, 
            origin: { y: 0 }, 
            ticks: 300,
            gravity: 2,
            // Строку с canvas: ... удаляем, она больше не нужна!
        });

        // Скрываем холст конфетти через некоторое время (чуть больше длительности анимации)
        // ticks: 400 это примерно 6-7 секунд (400 / 60 кадров/сек)
        // Скроем холст через 7 секунд.
        setTimeout(() => {
            confettiCanvas.classList.remove('show');
        }, 7000); 

        // Переход к следующему раунду через 2 секунды (независимо от конфетти)
        setTimeout(nextRound, 2000);
    } else {
        // Неправильно
        clickedBtn.classList.add('wrong');
        allBtns.forEach(btn => {
            if (btn.textContent === correctAnswer) {
                btn.classList.add('correct');
            }
        });

        popup.classList.add('show');
        
        setTimeout(() => {
            popup.classList.remove('show');
            setTimeout(nextRound, 800);
        }, 1500);
    }
}

steerBtn.addEventListener('click', () => {
    if (!currentShape) return;
    
    // Включаем отображение подсказки
    isHintVisible = true;
    renderScene(); // Перерисовываем холст, чтобы текст появился

    // Сбрасываем предыдущий таймер, если пользователь нажал кнопку несколько раз подряд
    // if (hintTimeout) clearTimeout(hintTimeout);

    // // Скрываем подсказку через 3 секунды (3000 мс)
    // hintTimeout = setTimeout(() => {
    //     isHintVisible = false;
    //     renderScene(); // Перерисовываем холст, чтобы стереть текст
    // }, 3000);
});
// Проверка ответа
// function checkAnswer() {
//     if (!currentShape) return;

//     const userAnswer = input.value.trim().toLowerCase();
//     const correctAnswer = currentShape.answer.trim().toLowerCase();

//     if (userAnswer === correctAnswer) {
//         // Правильно -> Конфетти
//         confetti({
//             particleCount: 100,
//             spread: 70,
//             origin: { y: 0.6 }
//         });
        
//         // Переход к следующему вопросу через 2 секунды
//         setTimeout(nextRound, 2000);
//     } else {
//         // Неправильно -> Всплывающее окно
//         popup.classList.add('show');
//         setTimeout(() => {
//             popup.classList.remove('show');
//         }, 1500);
//     }
// }
// Функция для генерации 3-х вариантов (1 верный, 2 случайных неверных)
function generateOptions(correctAnswer) {
    // Собираем все возможные ответы из JSON
    const allAnswers = shapesData.map(s => s.answer);
    
    // Оставляем только те, которые не являются правильным, и убираем дубликаты
    const wrongPool = [...new Set(allAnswers.filter(a => a !== correctAnswer))];
    
    let options = [correctAnswer];

    // Выбираем 2 случайных неверных ответа (если они есть в JSON)
    while (options.length < 3 && wrongPool.length > 0) {
        const randIdx = Math.floor(Math.random() * wrongPool.length);
        const selectedWrong = wrongPool.splice(randIdx, 1)[0]; // Берем и удаляем из пула
        options.push(selectedWrong);
    }

    // Если в JSON мало фигур (меньше 3-х разных), добавляем заглушки для теста
    if (options.length < 3) options.push("Горизонтальная прямая", "Профильная плоскость");

    // Перемешиваем варианты случайным образом
    return options.sort(() => Math.random() - 0.5);
}

// Обработчики событий
// submitBtn.addEventListener('click', checkAnswer);
// input.addEventListener('keypress', (e) => {
//     if (e.key === 'Enter') checkAnswer();
// });

// Инициализация
loadData();