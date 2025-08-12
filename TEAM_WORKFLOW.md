##########################################
# 1. 初始化仓库（由项目负责人执行一次）
##########################################

# 本地新建项目文件夹
mkdir lingjing_app
cd lingjing_app

# 初始化 Git 仓库
git init

# 可选：添加 README 和 .gitignore
echo "# lingjing_app" > README.md
touch .gitignore

# 添加文件并提交
git add .
git commit -m "init: initial commit"

# 设置主分支为 main
git branch -M main

# 连接远程仓库（将以下地址替换为你自己的）
git remote add origin https://github.com/your-org/lingjing_app.git

# 推送主分支到 GitHub
git push -u origin main


##########################################
# 2. 创建 develop 分支（由负责人执行一次）
##########################################

# 基于 main 创建 develop 分支
git checkout -b develop
git push -u origin develop


##########################################
# 3. 成员首次参与项目（每人执行一次）
##########################################

# 克隆远程项目
git clone https://github.com/your-org/lingjing_app.git
cd lingjing_app

# 拉取 develop 分支
git checkout develop
git pull origin develop

# 创建自己的功能分支（按功能命名）
git checkout -b feature/login-ui


##########################################
# 4. 每日开发流程（每人每天都要执行）
##########################################

# 步骤1：更新本地 develop 分支
git checkout develop
git pull origin develop

# 步骤2：切换回自己的分支并合并最新 develop
git checkout feature/login-ui
git merge develop   # 如有冲突，解决后再提交

# 步骤3：写代码，提交改动
git add .
git commit -m "feat: 完成登录页面 UI"

# 步骤4：推送到远程仓库
git push origin feature/login-ui


##########################################
# 5. 发起 Pull Request（推荐使用网页）
##########################################

# 访问仓库页面，GitHub 会提示创建 PR
# 比如：feature/login-ui → develop


##########################################
# 6. 合并前同步 develop 分支（避免冲突）
##########################################

# 确保你的 PR 是基于最新 develop 的
git checkout develop
git pull origin develop

# 合并到你的分支
git checkout feature/login-ui
git merge develop

# 如果有冲突，解决冲突文件后提交
git add .
git commit -m "resolve: 合并 develop 分支冲突"
git push origin feature/login-ui


##########################################
# 7. 合并后清理分支（保持干净）
##########################################

# 删除本地分支
git branch -d feature/login-ui

# 删除远程分支
git push origin --delete feature/login-ui


##########################################
# 8. 发布版本流程（由管理员执行）
##########################################

# Step 1: 创建发布分支
git checkout develop
git pull origin develop
git checkout -b release/v1.0.0
git push origin release/v1.0.0

# Step 2: 合并到 main 并打标签
git checkout main
git merge release/v1.0.0
git tag v1.0.0
git push origin main
git push origin v1.0.0
