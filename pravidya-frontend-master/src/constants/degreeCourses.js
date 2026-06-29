/**
 * Mapping of degree to course/specialization options.
 * Course options shown in dropdown depend on selected degree.
 */
export const DEGREE_TO_COURSES = {
  'B.E': [
    'Computer Science and Engineering', 'Information Technology', 'Mechanical Engineering', 'Civil Engineering',
    'Electrical Engineering', 'Electronics and Communication Engineering', 'Chemical Engineering',
    'Aerospace Engineering', 'Biotechnology', 'Industrial Engineering', 'Instrumentation Engineering'
  ],
  'B.Tech': [
    'Computer Science and Engineering', 'Information Technology', 'Mechanical Engineering', 'Civil Engineering',
    'Electrical Engineering', 'Electronics and Communication Engineering', 'Chemical Engineering',
    'Aerospace Engineering', 'Biotechnology', 'Industrial Engineering', 'Instrumentation Engineering'
  ],
  'B.Sc': [
    'Physics', 'Chemistry', 'Mathematics', 'Biology', 'Computer Science', 'Statistics', 'Electronics',
    'Biotechnology', 'Microbiology', 'Biochemistry', 'Environmental Science', 'Forensic Science'
  ],
  'B.Com': ['Accounting', 'Finance', 'Business Administration', 'Banking and Insurance', 'Taxation'],
  'B.A': ['Economics', 'English', 'History', 'Political Science', 'Sociology', 'Psychology', 'Philosophy'],
  'BBA': ['Business Administration', 'Marketing', 'Finance', 'Human Resources', 'International Business'],
  'BCA': ['Computer Applications', 'Information Technology', 'Software Development'],
  'B.Pharm': ['Pharmacy', 'Pharmaceutical Chemistry', 'Pharmacology'],
  'B.Arch': ['Architecture', 'Urban Design', 'Landscape Architecture'],
  'BDS': ['Dental Surgery'],
  'MBBS': ['Medicine'],
  'M.E': [
    'Computer Science and Engineering', 'Information Technology', 'Mechanical Engineering', 'Civil Engineering',
    'Electrical Engineering', 'Electronics and Communication Engineering', 'Chemical Engineering',
    'Aerospace Engineering', 'VLSI Design', 'Embedded Systems', 'Structural Engineering'
  ],
  'M.Tech': [
    'Computer Science and Engineering', 'Information Technology', 'Mechanical Engineering', 'Civil Engineering',
    'Electrical Engineering', 'Electronics and Communication Engineering', 'Chemical Engineering',
    'Aerospace Engineering', 'VLSI Design', 'Embedded Systems', 'Structural Engineering'
  ],
  'M.Sc': [
    'Physics', 'Chemistry', 'Mathematics', 'Biology', 'Computer Science', 'Statistics', 'Electronics',
    'Biotechnology', 'Microbiology', 'Biochemistry', 'Environmental Science', 'Data Science'
  ],
  'M.Com': ['Accounting', 'Finance', 'Business Administration', 'Banking and Insurance'],
  'M.A': ['Economics', 'English', 'History', 'Political Science', 'Sociology', 'Psychology', 'Philosophy'],
  'MBA': [
    'Finance', 'Marketing', 'Human Resources', 'Operations', 'Information Technology',
    'General Management', 'International Business', 'Healthcare Management', 'Business Analytics'
  ],
  'MCA': ['Computer Applications', 'Information Technology', 'Software Engineering'],
  'M.Pharm': ['Pharmaceutics', 'Pharmacology', 'Pharmaceutical Chemistry', 'Pharmacognosy'],
  'M.Arch': ['Architecture', 'Urban Design', 'Landscape Architecture'],
  'MDS': ['Conservative Dentistry', 'Oral Surgery', 'Orthodontics', 'Periodontology'],
  'MD': ['General Medicine', 'Pediatrics', 'Radiology', 'Pathology', 'Psychiatry'],
  'MS': ['General Surgery', 'Orthopedics', 'Ophthalmology', 'ENT'],
  'Ph.D': [
    'Computer Science', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Engineering',
    'Management', 'Commerce', 'Economics', 'English', 'History'
  ],
  'Diploma': [
    'Mechanical', 'Civil', 'Electrical', 'Electronics', 'Computer Science', 'Information Technology',
    'Chemical', 'Automobile', 'Instrumentation'
  ],
  'PG Diploma': [
    'Business Administration', 'Computer Applications', 'Data Science', 'Digital Marketing',
    'Financial Management', 'Human Resources'
  ],
  'Integrated B.Tech-M.Tech': [
    'Computer Science and Engineering', 'Mechanical Engineering', 'Civil Engineering',
    'Electrical Engineering', 'Electronics and Communication Engineering'
  ],
  'Integrated B.Sc-M.Sc': ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Computer Science']
};

/** Common course duration options for dropdown */
export const DURATION_OPTIONS = [
  '6 Months', '1 Year', '1.5 Years', '2 Years', '2.5 Years', '3 Years', '3.5 Years',
  '4 Years', '4.5 Years', '5 Years', '6 Years', 'PG Diploma (1 Year)', 'PG Diploma (2 Years)'
];

/** Common eligibility options for dropdown */
export const ELIGIBILITY_OPTIONS = [
  '8th Pass', '10th Pass', '12th Pass (PCM)', '12th Pass (PCB)', '12th Pass (Commerce)', '12th Pass (Arts)',
  'Graduate (Any)', 'Graduate (Relevant)', 'B.Tech/B.E', 'B.Sc', 'B.Com', 'B.A', 'BCA', 'MBA', 'MCA',
  'JEE Main', 'JEE Advanced', 'MHT-CET', 'KCET', 'NEET', 'Entrance Exam', 'Direct Admission'
];
