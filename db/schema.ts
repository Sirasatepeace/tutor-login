import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';
export const settings=sqliteTable('settings',{key:text('key').primaryKey(),value:text('value').notNull()});
export const people=sqliteTable('people',{id:text('id').primaryKey(),email:text('email').notNull(),name:text('name').notNull(),created:integer('created').notNull()});
export const courses=sqliteTable('courses',{id:text('id').primaryKey(),title:text('title').notNull(),description:text('description').notNull(),category:text('category').notNull(),published:integer('published').notNull().default(0),visibility:text('visibility').notNull().default('restricted'),created:integer('created').notNull()});
export const lessons=sqliteTable('lessons',{id:text('id').primaryKey(),courseId:text('course_id').notNull(),title:text('title').notNull(),description:text('description').notNull(),position:integer('position').notNull(),created:integer('created').notNull()});
export const lessonNotices=sqliteTable('lesson_notices',{id:text('id').primaryKey(),lessonId:text('lesson_id').notNull(),content:text('content').notNull(),created:integer('created').notNull()});
export const enrollments=sqliteTable('enrollments',{id:text('id').primaryKey(),courseId:text('course_id').notNull(),email:text('email').notNull(),userId:text('user_id'),name:text('name').notNull(),status:text('status').notNull(),expires:integer('expires'),created:integer('created').notNull()});
export const files=sqliteTable('files',{id:text('id').primaryKey(),lessonId:text('lesson_id').notNull(),name:text('name').notNull(),kind:text('kind').notNull(),size:integer('size').notNull(),objectKey:text('object_key').notNull(),created:integer('created').notNull()});
export const uploads=sqliteTable('uploads',{id:text('id').primaryKey(),lessonId:text('lesson_id').notNull(),name:text('name').notNull(),kind:text('kind').notNull(),size:integer('size').notNull(),objectKey:text('object_key').notNull(),uploadId:text('upload_id').notNull(),created:integer('created').notNull()});
export const progress=sqliteTable('progress',{id:text('id').primaryKey(),userId:text('user_id').notNull(),lessonId:text('lesson_id').notNull(),seconds:integer('seconds').notNull().default(0),done:integer('done').notNull().default(0)});
export const loginAccounts=sqliteTable('login_accounts',{userId:text('user_id').primaryKey(),username:text('username').notNull().unique(),name:text('name').notNull(),nickname:text('nickname').notNull().default(''),grade:text('grade').notNull().default(''),school:text('school').notNull().default(''),email:text('email').notNull(),passwordHash:text('password_hash').notNull(),firstName:text('first_name').notNull().default(''),lastName:text('last_name').notNull().default(''),nameStatus:text('name_status').notNull().default('legacy'),nameFlags:text('name_flags').notNull().default('[]'),nameVersion:integer('name_version').notNull().default(1),nameReviewNote:text('name_review_note').notNull().default(''),nameReviewedBy:text('name_reviewed_by'),nameReviewedAt:integer('name_reviewed_at'),disabled:integer('disabled').notNull().default(0),version:integer('version').notNull().default(1),created:integer('created').notNull()},table=>[index('accounts_name_status_idx').on(table.nameStatus)]);
export const loginSessions=sqliteTable('login_sessions',{tokenHash:text('token_hash').primaryKey(),userId:text('user_id').notNull(),accountVersion:integer('account_version').notNull(),deviceId:text('device_id').notNull().default('legacy'),expires:integer('expires').notNull()});
export const loginLimits=sqliteTable('login_limits',{key:text('key').primaryKey(),count:integer('count').notNull(),expires:integer('expires').notNull()});
export const authEvents=sqliteTable('auth_events',{id:text('id').primaryKey(),userId:text('user_id').notNull(),username:text('username').notNull(),deviceId:text('device_id').notNull(),event:text('event').notNull(),created:integer('created').notNull()});
export const exams=sqliteTable('exams',{
 id:text('id').primaryKey(),courseId:text('course_id').notNull(),title:text('title').notNull(),description:text('description').notNull().default(''),
 questions:text('questions').notNull().default('[]'),published:integer('published').notNull().default(0),showAnswers:integer('show_answers').notNull().default(0),
 revision:integer('revision').notNull().default(1),created:integer('created').notNull(),updated:integer('updated').notNull(),
},table=>[index('exams_course_idx').on(table.courseId)]);
export const examImages=sqliteTable('exam_images',{
 id:text('id').primaryKey(),courseId:text('course_id').notNull(),name:text('name').notNull(),contentType:text('content_type').notNull(),
 size:integer('size').notNull(),objectKey:text('object_key').notNull(),created:integer('created').notNull(),
},table=>[index('exam_images_course_idx').on(table.courseId)]);
export const examAttempts=sqliteTable('exam_attempts',{
 id:text('id').primaryKey(),examId:text('exam_id').notNull(),courseId:text('course_id').notNull(),userId:text('user_id').notNull(),
 revision:integer('revision').notNull(),score:integer('score').notNull(),totalPoints:integer('total_points').notNull(),
 result:text('result').notNull(),created:integer('created').notNull(),
},table=>[index('exam_attempts_student_idx').on(table.examId,table.userId,table.created),index('exam_attempts_course_idx').on(table.courseId,table.userId)]);

export const siteDailyActivity=sqliteTable('site_daily_activity',{day:text('day').notNull(),userId:text('user_id').notNull(),pageViews:integer('page_views').notNull().default(0),firstSeen:integer('first_seen').notNull(),lastSeen:integer('last_seen').notNull()},table=>[primaryKey({columns:[table.day,table.userId]}),index('site_activity_seen_idx').on(table.lastSeen)]);
export const assistantRequests=sqliteTable('assistant_requests',{id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),message:text('message').notNull(),answer:text('answer').notNull().default(''),reports:text('reports').notNull().default('[]'),mode:text('mode').notNull(),status:text('status').notNull().default('pending'),created:integer('created').notNull()},table=>[index('assistant_history_idx').on(table.ownerId,table.created)]);
