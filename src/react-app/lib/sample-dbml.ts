export const SAMPLE_DBML = `Table users {
  id integer [pk]
  full_name varchar [not null]
  email varchar [unique, not null]
  team_id integer
  created_at timestamp [not null]
}

Table teams {
  id integer [pk]
  name varchar [not null]
  slug varchar [unique, not null]
}

Table projects {
  id integer [pk]
  team_id integer [not null]
  owner_id integer [not null]
  name varchar [not null]
  status varchar [not null]
}

Table project_members {
  project_id integer [not null]
  user_id integer [not null]
  role varchar [not null]
}

Table tasks {
  id integer [pk]
  project_id integer [not null]
  assignee_id integer
  title varchar [not null]
  state varchar [not null]
}

Ref: users.team_id > teams.id
Ref: projects.team_id > teams.id
Ref: projects.owner_id > users.id
Ref: project_members.project_id > projects.id
Ref: project_members.user_id > users.id
Ref: tasks.project_id > projects.id
Ref: tasks.assignee_id > users.id
`;
