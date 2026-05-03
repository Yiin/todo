export interface Task {
  id: string
  text: string
  completed: boolean
  position: number
}

export interface Category {
  id: string
  name: string
  position: number
  tasks: Task[]
}

export interface ListData {
  id: string
  created_at: string
  categories: Category[]
}
