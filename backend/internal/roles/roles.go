package roles

const (
	Reader      = "READER"
	Author      = "AUTHOR"
	Admin       = "ADMIN"
	SuperAdmin  = "SUPER_ADMIN"
)

var rank = map[string]int{
	Reader:     1,
	Author:     2,
	Admin:      3,
	SuperAdmin: 4,
}

func HasAtLeast(userRole, required string) bool {
	return rank[userRole] >= rank[required]
}
