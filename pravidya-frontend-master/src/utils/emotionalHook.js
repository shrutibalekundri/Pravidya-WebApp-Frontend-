export function calculateEmotionalHook(formData = {}) {
  const s2 = formData.step2 || {};
  const s3 = formData.step3 || {};
  const s4 = formData.step4 || {};
  const s5 = formData.step5 || {};

  let score = s5.conversionProbability != null ? Number(s5.conversionProbability) : 50;
  if (Number.isNaN(score)) score = 50;

  const add = (n) => {
    score += n;
  };

  // Student motivation
  switch (s5.studentMotivation) {
    case 'Highly motivated':
      add(15);
      break;
    case 'Moderately motivated':
      add(5);
      break;
    case 'Parent pushing the decision':
    case 'Student unsure':
      add(-10);
      break;
    case 'Student not interested':
      add(-25);
      break;
    default:
      break;
  }

  // Admission seriousness
  switch (s5.admissionSeriousness) {
    case 'Very serious':
      add(10);
      break;
    case 'Moderate':
      add(5);
      break;
    case 'Just exploring':
      add(-10);
      break;
    case 'Not serious':
      add(-20);
      break;
    default:
      break;
  }

  // Admission urgency
  switch (s4.admissionUrgency || s4.admissionTimeline) {
    case 'Immediate':
    case 'Immediate admission':
      add(10);
      break;
    case 'Within 1 month':
      add(5);
      break;
    case 'Within 3 months':
      break;
    case 'Just exploring options':
    case 'Exploring':
    case 'Not decided':
      add(-10);
      break;
    default:
      break;
  }

  // Lead temperature
  switch (s5.leadTemperature) {
    case 'Hot':
      add(15);
      break;
    case 'Warm':
      add(5);
      break;
    case 'Cold':
      add(-15);
      break;
    default:
      break;
  }

  // Parent involvement
  switch (s5.parentInvolvement) {
    case 'Very involved':
      add(8);
      break;
    case 'Moderate':
      add(3);
      break;
    case 'Minimal':
      add(-5);
      break;
    default:
      break;
  }

  // Trust in counselling
  switch (s4.trustCounselling) {
    case 'High':
      add(5);
      break;
    case 'Moderate':
      add(2);
      break;
    case 'Low':
      add(-8);
      break;
    default:
      break;
  }

  // Competition
  switch (s5.competitionConsultants) {
    case 'Yes strong':
      add(-15);
      break;
    case 'Some':
      add(-5);
      break;
    default:
      break;
  }

  // Fee sensitivity
  switch (s3.feeSensitivity) {
    case 'Very sensitive':
      add(-10);
      break;
    case 'Somewhat sensitive':
      add(-5);
      break;
    default:
      break;
  }

  // Counsellor assessment
  switch (s5.counsellorAssessment) {
    case 'Hot \u2013 will join':
      add(15);
      break;
    case 'Warm \u2013 likely':
      add(7);
      break;
    case 'Cold \u2013 unlikely':
      add(-15);
      break;
    default:
      break;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let hookLevel;
  if (score >= 80) hookLevel = 'High emotional hook';
  else if (score >= 60) hookLevel = 'Medium emotional hook';
  else hookLevel = 'Low emotional hook';

  const positives = [];
  const negatives = [];

  if (s5.studentMotivation === 'Highly motivated') positives.push('Student is highly motivated');
  else if (s5.studentMotivation === 'Moderately motivated') positives.push('Student is moderately motivated');
  if (s5.admissionSeriousness === 'Very serious') positives.push('Very serious about admission');
  if (s4.admissionUrgency === 'Immediate' || s4.admissionTimeline === 'Immediate admission') positives.push('Immediate admission urgency');
  if (s5.parentInvolvement === 'Very involved') positives.push('Parent is actively involved');
  if (s4.trustCounselling === 'High') positives.push('High trust in counselling');

  if (s3.feeSensitivity === 'Very sensitive') negatives.push('Very fee sensitive');
  if (s5.competitionConsultants === 'Yes strong') negatives.push('Strong competition from other consultants');
  if (s5.studentMotivation === 'Student not interested') negatives.push('Student is not interested');
  if (s5.admissionSeriousness === 'Not serious') negatives.push('Low seriousness about admission');

  let recommendation;
  if (score >= 80) {
    recommendation = 'Move to closure: share offer details and start admission formalities.';
  } else if (score >= 60) {
    recommendation = 'High potential: schedule a focused follow-up (campus visit / detailed counselling).';
  } else if (score >= 40) {
    recommendation = 'Uncertain: address key concerns (fees, placement, course fit) and nurture with follow-ups.';
  } else {
    recommendation = 'Low priority: keep in long-term nurture, focus effort on higher scoring leads.';
  }

  // Map to higher-level emotional analytics
  let primaryEmotionalHook = 'Exploring better opportunities';
  if (s5.studentMotivation === 'Highly motivated' && s5.admissionSeriousness === 'Very serious') {
    primaryEmotionalHook = 'Career growth and job security';
  } else if (s3.feeSensitivity === 'Very sensitive' || s3.financialDependency === 'Loan required' || s3.financialDependency === 'Scholarship dependent') {
    primaryEmotionalHook = 'Financial concern and affordability';
  } else if (s4.admissionUrgency === 'Immediate' || s4.admissionTimeline === 'Immediate admission') {
    primaryEmotionalHook = 'Fear of missing opportunity this year';
  } else if (s5.parentInvolvement === 'Very involved' && s5.studentMotivation !== 'Highly motivated') {
    primaryEmotionalHook = 'Parental aspiration and guidance';
  }

  let urgencyLevel = 'Medium';
  if (s4.admissionUrgency === 'Immediate' || s4.admissionTimeline === 'Immediate admission') urgencyLevel = 'High';
  else if (s4.admissionUrgency === 'Within 1 month') urgencyLevel = 'High';
  else if (s4.admissionUrgency === 'Within 3 months') urgencyLevel = 'Medium';
  else if (s4.admissionUrgency === 'Exploring' || s4.admissionUrgency === 'Not decided' || s4.admissionTimeline === 'Just exploring options') urgencyLevel = 'Low';

  let decisionMaker = 'Both';
  if (s5.parentInvolvement === 'Very involved' && (s5.studentMotivation === 'Student unsure' || s5.studentMotivation === 'Student not interested')) {
    decisionMaker = 'Parent';
  } else if (s5.studentMotivation === 'Highly motivated' && (s5.parentInvolvement === 'Minimal' || s5.parentInvolvement === 'Student leading')) {
    decisionMaker = 'Student';
  }

  let financialSensitivity = 'Medium';
  if (s3.feeSensitivity === 'Very sensitive' || s3.financialDependency === 'Loan required' || s3.financialDependency === 'Scholarship dependent') {
    financialSensitivity = 'High';
  } else if (s3.feeSensitivity === 'Not sensitive') {
    financialSensitivity = 'Low';
  }

  const painPoints = [];
  if (s3.feeSensitivity === 'Very sensitive') painPoints.push('Very sensitive to fees and overall cost');
  if (s3.financialDependency === 'Loan required') painPoints.push('Needs loan support to afford the program');
  if (s3.financialDependency === 'Scholarship dependent') painPoints.push('Highly dependent on scholarship or discount');
  if (s5.studentMotivation === 'Student unsure') painPoints.push('Student is unsure about the decision');
  if (s5.studentMotivation === 'Student not interested') painPoints.push('Student currently not interested in higher education');
  if (s5.admissionSeriousness === 'Just exploring') painPoints.push('Only exploring options, not fully committed yet');
  if (s5.admissionSeriousness === 'Not serious') painPoints.push('Low seriousness about taking admission');
  if (s5.competitionConsultants === 'Yes strong') painPoints.push('Strong competition from other consultants or colleges');

  if (painPoints.length === 0 && negatives.length > 0) {
    painPoints.push(...negatives);
  }

  const leadIntentScore = score;

  const summaryParts = [];
  summaryParts.push(`Overall emotional hook is ${hookLevel.toLowerCase()} with an intent score of ${leadIntentScore}/100.`);
  if (primaryEmotionalHook) {
    summaryParts.push(`Primary emotional driver is ${primaryEmotionalHook.toLowerCase()}.`);
  }
  if (financialSensitivity === 'High') {
    summaryParts.push('Family is highly sensitive to fees, so financial planning and scholarships will be important.');
  }
  const emotionalSummary = summaryParts.join(' ');

  return {
    // Old fields (still available)
    interestScore: score,
    hookLevel,
    positives,
    negatives,
    recommendation,
    // New structured emotional analytics
    primary_emotional_hook: primaryEmotionalHook,
    pain_points: painPoints,
    urgency_level: urgencyLevel,
    decision_maker: decisionMaker,
    financial_sensitivity: financialSensitivity,
    lead_intent_score: leadIntentScore,
    emotional_summary: emotionalSummary,
  };
}

