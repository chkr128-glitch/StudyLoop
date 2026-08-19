import { SUBJECTS } from '../utils/constants.js';

let chartSubjectInstance = null;
let chartEvalInstance = null;
let chartRadarInstance = null;

export function updateChartColors() { 
    const isDark = document.documentElement.classList.contains('dark'); 
    
    // Chart.js がグローバルに読み込まれているか確認
    if (typeof Chart !== 'undefined') {
        Chart.defaults.color = isDark ? '#9CA3AF' : '#6B7280'; 
    }
    
    if (chartRadarInstance) {
        chartRadarInstance.options.scales.r.angleLines.color = isDark ? 'rgba(156, 163, 175, 0.2)' : 'rgba(0, 0, 0, 0.1)';
        chartRadarInstance.options.scales.r.grid.color = isDark ? 'rgba(156, 163, 175, 0.2)' : 'rgba(0, 0, 0, 0.1)';
        chartRadarInstance.update();
    }
    if (chartSubjectInstance) chartSubjectInstance.update(); 
    if (chartEvalInstance) chartEvalInstance.update(); 
}

export function renderAnalytics(tasks, userProfile) {
    if (!tasks || !userProfile) return;

    // 完了したタスクの実績を集計
    const completed = tasks.filter(t => t.completed && t.actualTime > 0 && !t.deleted);
    const subData = {}; SUBJECTS.forEach(s => subData[s] = 0); 
    const evalData = {'A':0, 'B':0, 'C':0, 'D':0};
    
    completed.forEach(t => { 
        subData[t.subject || 'その他'] += Number(t.actualTime); 
        if(t.evaluation) evalData[t.evaluation]++; 
    });

    const bgColors = ['#F472B6', '#C084FC', '#FB7185', '#34D399', '#FBBF24', '#818CF8', '#9CA3AF'];
    const targetWeights = []; const actualTimes = []; 
    let totalWeight = 0; let totalActualTime = 0;
    const targetWeightsMap = { '英語': 0, '数学': 0, '国語': 0, '理科': 0, '社会': 0, '情報': 0, 'その他': 0 };

    if (userProfile.examScores) {
        const cs = userProfile.examScores.common || {}; 
        const ss = userProfile.examScores.second || {};
        targetWeightsMap['国語'] = (parseInt(cs['国語'])||0) + (parseInt(ss['国語'])||0); 
        targetWeightsMap['数学'] = (parseInt(cs['数学IA'])||0) + (parseInt(cs['数学IIBC'])||0) + (parseInt(ss['数学'])||0); 
        targetWeightsMap['英語'] = (parseInt(cs['英語R'])||0) + (parseInt(cs['英語L'])||0) + (parseInt(ss['英語'])||0); 
        targetWeightsMap['情報'] = (parseInt(cs['情報'])||0); 
        targetWeightsMap['社会'] = (parseInt(cs['社会1_score'])||0) + (parseInt(cs['社会2_score'])||0) + (parseInt(ss['社会1_score'])||0) + (parseInt(ss['社会2_score'])||0); 
        targetWeightsMap['理科'] = (parseInt(cs['理科1_score'])||0) + (parseInt(cs['理科2_score'])||0) + (parseInt(ss['理科1_score'])||0) + (parseInt(ss['理科2_score'])||0);
    } else if (userProfile.weights) { 
        SUBJECTS.forEach(s => targetWeightsMap[s] = parseInt(userProfile.weights[s]) || 0); 
    }

    SUBJECTS.forEach(s => { const w = targetWeightsMap[s] || 0; totalWeight += w; totalActualTime += subData[s]; });
    SUBJECTS.forEach(s => { 
        const w = targetWeightsMap[s] || 0; 
        targetWeights.push(totalWeight > 0 ? (w / totalWeight * 100).toFixed(1) : 0); 
        actualTimes.push(totalActualTime > 0 ? (subData[s] / totalActualTime * 100).toFixed(1) : 0); 
    });

    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(156, 163, 175, 0.2)' : 'rgba(0, 0, 0, 0.1)';

    if(chartRadarInstance) chartRadarInstance.destroy();
    chartRadarInstance = new Chart(document.getElementById('chart-radar'), { 
        type: 'radar', 
        data: { 
            labels: SUBJECTS, 
            datasets: [ 
                { label: '志望校の配点比率 (%)', data: targetWeights, borderColor: '#F472B6', backgroundColor: 'rgba(244, 114, 182, 0.3)', borderWidth: 2, pointBackgroundColor: '#F472B6' }, 
                { label: '実際の学習時間比率 (%)', data: actualTimes, borderColor: '#A855F7', backgroundColor: 'rgba(168, 85, 247, 0.3)', borderWidth: 2, pointBackgroundColor: '#A855F7' } 
            ] 
        }, 
        options: { 
            responsive: true, maintainAspectRatio: false, 
            scales: { r: { angleLines: { color: gridColor }, grid: { color: gridColor }, pointLabels: { font: { size: 11, weight: 'bold' } }, ticks: { display: false, backdropColor: 'transparent' } } }, 
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } } 
        } 
    });

    if(chartSubjectInstance) chartSubjectInstance.destroy(); 
    chartSubjectInstance = new Chart(document.getElementById('chart-subject'), { 
        type: 'doughnut', 
        data: { labels: SUBJECTS, datasets: [{ data: SUBJECTS.map(s => subData[s]), backgroundColor: bgColors, borderWidth: 0 }] }, 
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right', labels: {font:{size: 10}} } } } 
    });
    
    if(chartEvalInstance) chartEvalInstance.destroy(); 
    chartEvalInstance = new Chart(document.getElementById('chart-evaluation'), { 
        type: 'pie', 
        data: { labels: ['A (完璧)', 'B (不安)', 'C (復習)', 'D (無理)'], datasets: [{ data: [evalData['A'], evalData['B'], evalData['C'], evalData['D']], backgroundColor: ['#F472B6', '#C084FC', '#FBBF24', '#FB7185'], borderWidth: 0 }] }, 
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: {font:{size: 10}} } } } 
    });
    
    updateChartColors();
}
